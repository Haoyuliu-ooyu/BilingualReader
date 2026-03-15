import json
from pydantic import BaseModel, Field, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from sqlalchemy.orm import Session
from .models import SourceSegment, Translation, ProjectMetadata
import uuid

# Define expected output structure
class TranslatedSegment(BaseModel):
    seg_id: str = Field(description="The exact seg_id provided in the input.")
    translated_text: str = Field(description="The translated string.")

class TranslationOutput(BaseModel):
    items: list[TranslatedSegment]

class TranslationAgent:
    def __init__(self, db_session: Session, llm_client=None):
        self.db = db_session
        self.llm_client = llm_client

    @retry(
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1.5, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True
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
            "2. Do NOT change the 'seg_id's.\n"
            "3. Do NOT output markdown or conversational text. Start with { and end with }."
        )

        input_json = json.dumps(chunk_data)

        # Estimate output tokens: each segment needs ~80 tokens for JSON overhead
        # (seg_id, keys, translated text) — scale up for safety.
        estimated_tokens = len(chunk_data) * 120 + 256
        max_tokens = max(4096, estimated_tokens)

        raw_text = self.llm_client.generate(
            system_prompt=system_prompt,
            user_message=f"Translate these segments:\n{input_json}",
            max_tokens=max_tokens,
            temperature=0.2,
        )

        # Strip markdown wrapper if the model disobeys
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        try:
            parsed = json.loads(raw_text)
            validated = TranslationOutput(**parsed)
            return [item.model_dump() for item in validated.items]
        except (json.JSONDecodeError, ValidationError) as e:
            print(f"LLM Output Error: {e}")
            print(f"Raw Output: {raw_text}")
            raise Exception(f"Failed to parse LLM output: {e}")

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

    def process_document(self, doc_id: str, target_lang: str):
        """
        Translates a document via chunks and saves to DB. 
        Supports checkpointing by checking which segments are already translated.
        """
        print(f"Starting translation process for Doc {doc_id} to {target_lang}")
        
        # 1. Fetch World Bible
        metadata = self.db.query(ProjectMetadata).filter(ProjectMetadata.doc_id == doc_id).first()
        world_bible = metadata.world_bible_json if metadata else {}
        
        # 2. Extract Segments that need translation
        # Query segments for this doc_id
        # In SQLAlchemy, we join Page to ensure doc_id matches
        from sqlalchemy.orm import aliased
        
        segments = self.db.query(SourceSegment).join(SourceSegment.page).filter(
            SourceSegment.page.has(doc_id=doc_id)
        ).order_by(SourceSegment.page_id, SourceSegment.block_index).all()
        
        # Checkpoint filter: Find untranslated segments
        untranslated = []
        for seg in segments:
            has_translation = self.db.query(Translation).filter(
                Translation.seg_id == seg.seg_id,
                Translation.target_language == target_lang
            ).first()
            if not has_translation:
                untranslated.append(seg)
                
        print(f"Found {len(untranslated)} untranslated segments out of {len(segments)} total.")
        
        # 3. Chunk
        chunks = self.chunk_segments(untranslated)
        
        # 4. Process Chunks
        for idx, chunk in enumerate(chunks):
            print(f"Translating chunk {idx+1}/{len(chunks)} ({len(chunk)} segments)...")
            
            translated_data = self.call_llm(chunk, world_bible, target_lang)
            
            # 5. Save Results
            for item in translated_data:
                db_trans = Translation(
                    seg_id=uuid.UUID(item['seg_id']),
                    target_language=target_lang,
                    translated_text=item['translated_text']
                )
                self.db.add(db_trans)
            
            self.db.commit() # Commit after each chunk for checkpointing
            
        print("Translation complete.")
