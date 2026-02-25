import os
import json
import anthropic
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
    def __init__(self, db_session: Session):
        self.db = db_session
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if api_key:
            self.client = anthropic.Anthropic(api_key=api_key)
        else:
            self.client = None
            print("Warning: ANTHROPIC_API_KEY not set. Generating mock Translations.")
            
        self.model = "claude-sonnet-4-6" 

    @retry(
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1.5, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True
    )
    def call_claude(self, chunk_data: list, world_bible: dict, target_lang: str) -> list[dict]:
        if not self.client:
             # Mock Translation
             return [{"seg_id": item['seg_id'], "translated_text": f"[ES] {item['original_text']}"} for item in chunk_data]
             
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

        # We pass structured output instruction in system prompt.
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            temperature=0.2, # Low temp for translation consistency
            system=system_prompt,
            messages=[
                {"role": "user", "content": f"Translate these segments:\n{input_json}"}
            ]
        )
        
        raw_text = response.content[0].text.strip()
        
        # Strip markdown if Claude disobeys
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        try:
            parsed = json.loads(raw_text)
            # Validate with Pydantic
            validated = TranslationOutput(**parsed)
            return [item.model_dump() for item in validated.items]
        except (json.JSONDecodeError, ValidationError) as e:
            print(f"Claude Output Error: {e}")
            print(f"Raw Output: {raw_text}")
            raise Exception(f"Failed to parse Claude output: {e}")

    def chunk_segments(self, segments, max_words=1000):
        """Groups segments into chunks respecting token/word limits to avoid 4096 output cap."""
        chunks = []
        current_chunk = []
        current_words = 0
        
        for seg in segments:
            word_count = len(seg.original_text.split())
            if current_words + word_count > max_words and current_chunk:
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
        chunks = self.chunk_segments(untranslated, max_words=1200) # Safe buffer for output tokens
        
        # 4. Process Chunks
        for idx, chunk in enumerate(chunks):
            print(f"Translating chunk {idx+1}/{len(chunks)} ({len(chunk)} segments)...")
            
            translated_data = self.call_claude(chunk, world_bible, target_lang)
            
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
