import json
import uuid

import structlog
from pydantic import BaseModel, Field, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from sqlalchemy.orm import Session

from errors import LLMAuthError, LLMRateLimitError, LLMContentPolicyError, LLMTransientError
from .models import SourceSegment, Translation, ProjectMetadata

log = structlog.get_logger("worker.translator")

# Define expected output structure
class TranslatedSegment(BaseModel):
    seg_id: str = Field(description="The exact seg_id provided in the input.")
    translated_text: str = Field(description="The translated string.")

class TranslationOutput(BaseModel):
    items: list[TranslatedSegment]

class TranslationAgent:
    def __init__(self, db_session: Session, llm_client=None, shutdown_event=None, progress_callback=None):
        self.db = db_session
        self.llm_client = llm_client
        self.shutdown_event = shutdown_event
        self.progress_callback = progress_callback

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=2, max=60),
        retry=retry_if_exception_type((LLMRateLimitError, LLMTransientError)),
        reraise=True,
    )
    def call_llm(self, chunk_data: list, world_bible: dict, target_lang: str) -> list[dict]:
        if not self.llm_client:
            # Mock Translation
            return [{"seg_id": item['seg_id'], "translated_text": f"[{target_lang}] {item['original_text']}"} for item in chunk_data]

        system_prompt = (
            f"You are an expert literary translator into {target_lang}. "
            "You will receive a JSON list of objects containing 'seg_id' and 'original_text'. "
            "Translate 'original_text' into the target language. "
            f"STRICTLY adhere to this World Bible for character names, tone, and terminology:\n{json.dumps(world_bible, indent=2)}\n\n"
            "CRITICAL EXPORT RULES:\n"
            "1. Output ONLY a valid JSON object with an 'items' array.\n"
            "2. Each item must have ONLY 'seg_id' and 'translated_text'. Do NOT include 'original_text' in the output.\n"
            "3. Do NOT change the 'seg_id's.\n"
            "4. You MUST translate ALL segments provided. Do not skip any.\n"
            "5. Do NOT output markdown or conversational text. Start with { and end with }."
        )

        input_json = json.dumps(chunk_data)

        # Estimate output tokens based on actual source text length.
        # CJK languages (Chinese, Japanese, Korean) expand to ~2-3x more tokens
        # than English because each character is 1-3 tokens.
        source_words = sum(len(item['original_text'].split()) for item in chunk_data)
        cjk_prefixes = ('ZH', 'JA', 'KO')
        is_cjk = target_lang.upper().startswith(cjk_prefixes)
        tokens_per_word = 8 if is_cjk else 3
        content_tokens = source_words * tokens_per_word
        json_overhead = len(chunk_data) * 80  # seg_id, keys, braces per item
        estimated_tokens = content_tokens + json_overhead + 256
        max_tokens = max(8192, estimated_tokens)

        raw_text = self.llm_client.generate(
            system_prompt=system_prompt,
            user_message=f"Translate these segments:\n{input_json}",
            max_tokens=max_tokens,
            temperature=0.2,
            json_mode=True,
        )

        # Strip markdown wrapper if the model disobeys
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        try:
            parsed = json.loads(raw_text)
            validated = TranslationOutput(**parsed)
            results = [item.model_dump() for item in validated.items]

            # Validate completeness: all sent seg_ids must be present
            sent_ids = {item['seg_id'] for item in chunk_data}
            got_ids = {item['seg_id'] for item in results}
            missing = sent_ids - got_ids
            if missing:
                log.warning("translator.incomplete_response",
                            returned=len(results), expected=len(chunk_data), missing=len(missing))
                raise LLMTransientError(
                    f"Incomplete translation: got {len(results)}/{len(chunk_data)} segments",
                    self.llm_client.config.provider if self.llm_client else "mock",
                )

            return results
        except (json.JSONDecodeError, ValidationError) as e:
            log.error("translator.parse_error", error=str(e), raw_output=raw_text[:500])
            raise LLMTransientError(
                f"Failed to parse LLM output: {e}",
                self.llm_client.config.provider if self.llm_client else "mock",
            )

    def chunk_segments(self, segments, max_segments=40, max_words=500):
        """Groups segments into chunks with both segment count and word limits.

        Each segment adds ~80-120 tokens of JSON overhead (seg_id, keys, braces)
        on top of the translated text itself, so we cap both dimensions to keep
        the LLM output well within token limits.
        """
        chunks = []
        current_chunk = []
        current_words = 0

        for seg in segments:
            word_count = len(seg.original_text.split())
            if current_chunk and (
                len(current_chunk) >= max_segments or
                current_words + word_count > max_words
            ):
                chunks.append(current_chunk)
                current_chunk = []
                current_words = 0

            current_chunk.append({
                "seg_id": str(seg.seg_id),
                "original_text": seg.original_text
            })
            current_words += word_count

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def _get_untranslated(self, segments, target_lang):
        """Return segments that don't have a translation yet."""
        untranslated = []
        for seg in segments:
            has_translation = self.db.query(Translation).filter(
                Translation.seg_id == seg.seg_id,
                Translation.target_language == target_lang
            ).first()
            if not has_translation:
                untranslated.append(seg)
        return untranslated

    def _save_translations(self, translated_data, target_lang):
        """Save translated items to DB, skipping duplicates."""
        saved = 0
        for item in translated_data:
            existing = self.db.query(Translation).filter(
                Translation.seg_id == uuid.UUID(item['seg_id']),
                Translation.target_language == target_lang
            ).first()
            if not existing:
                db_trans = Translation(
                    seg_id=uuid.UUID(item['seg_id']),
                    target_language=target_lang,
                    translated_text=item['translated_text']
                )
                self.db.add(db_trans)
                saved += 1
        self.db.commit()
        return saved

    def process_document(self, doc_id: str, target_lang: str):
        """
        Translates a document via chunks and saves to DB.
        Uses multiple passes with shrinking chunk sizes to handle partial LLM responses.
        """
        log.info("translator.starting", doc_id=doc_id, target_lang=target_lang)

        # 1. Fetch World Bible
        metadata = self.db.query(ProjectMetadata).filter(ProjectMetadata.doc_id == doc_id).first()
        world_bible = metadata.world_bible_json if metadata else {}

        # 2. Get all segments for this document
        segments = self.db.query(SourceSegment).join(SourceSegment.page).filter(
            SourceSegment.page.has(doc_id=doc_id)
        ).order_by(SourceSegment.page_id, SourceSegment.block_index).all()

        total = len(segments)
        max_passes = 3
        chunk_sizes = [(20, 300), (8, 150), (3, 80)]  # progressively smaller chunks

        for pass_num in range(max_passes):
            untranslated = self._get_untranslated(segments, target_lang)
            if not untranslated:
                break

            max_seg, max_w = chunk_sizes[min(pass_num, len(chunk_sizes) - 1)]
            log.info("translator.pass_starting", pass_num=pass_num + 1,
                     untranslated=len(untranslated), total=total,
                     max_segments=max_seg, max_words=max_w)

            chunks = self.chunk_segments(untranslated, max_segments=max_seg, max_words=max_w)

            for idx, chunk in enumerate(chunks):
                # Check shutdown between chunks
                if self.shutdown_event and self.shutdown_event.is_set():
                    translated_so_far = total - len(self._get_untranslated(segments, target_lang))
                    log.info("translator.shutdown_requested", job_id=doc_id,
                             translated=translated_so_far, total=total)
                    raise InterruptedError("Shutdown requested during translation")

                log.info("translator.chunk_starting", chunk=idx + 1,
                         total_chunks=len(chunks), segments=len(chunk))
                try:
                    translated_data = self.call_llm(chunk, world_bible, target_lang)
                    saved = self._save_translations(translated_data, target_lang)
                    log.info("translator.chunk_complete", chunk=idx + 1,
                             total_chunks=len(chunks), saved=saved)

                    # Report progress after each successful chunk
                    if self.progress_callback:
                        translated_so_far = total - len(self._get_untranslated(segments, target_lang))
                        self.progress_callback(translated_so_far, total)

                except LLMContentPolicyError as e:
                    log.warning("translator.chunk_blocked", chunk=idx + 1, error=str(e),
                                blocked_segments=[s["seg_id"] for s in chunk])
                    # Skip this chunk -- segments remain untranslated, marked as blocked
                    continue
                except LLMAuthError:
                    raise  # Fatal -- propagate up immediately
                except Exception as e:
                    log.error("translator.chunk_failed", chunk=idx + 1, error=str(e))

        # Final check
        remaining = self._get_untranslated(segments, target_lang)
        if remaining:
            log.warning("translator.incomplete", remaining=len(remaining), total=total, passes=max_passes)
            raise Exception(f"Translation incomplete: {len(remaining)}/{total} segments untranslated")

        log.info("translator.complete", doc_id=doc_id)
