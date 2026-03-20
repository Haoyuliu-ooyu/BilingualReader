import json

import structlog
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from sqlalchemy.orm import Session
from .models import ProjectMetadata

from typing import Union, List

from errors import LLMRateLimitError, LLMTransientError

log = structlog.get_logger("worker.context_agent")


# --- Genre-specific Pydantic models ---

class NameMapping(BaseModel):
    """Explicit name-to-translation mapping for proper nouns."""
    source_name: str = Field(description="Name in source language")
    translated_name: str = Field(description="Canonical translation")
    aliases: list[str] = Field(default_factory=list, description="Alternative forms in source text")


class TranslationContext(BaseModel):
    """Genre-neutral base context."""
    genre: str = Field(description="Document genre: fiction, technical, legal, academic, general")
    name_mappings: list[NameMapping] = Field(default_factory=list, description="Explicit name->translation mappings")
    glossary: list[dict[str, Union[str, List[str]]]] = Field(default_factory=list)
    style_guide: str = Field(default="", description="Tone, formality, perspective")


class FictionContext(TranslationContext):
    characters: list[dict[str, Union[str, List[str]]]] = Field(default_factory=list, description="Characters with traits")


class TechnicalContext(TranslationContext):
    terminology: list[dict[str, str]] = Field(default_factory=list, description="Technical terms and definitions")
    abbreviations: list[dict[str, str]] = Field(default_factory=list)
    domain: str = Field(default="", description="Technical domain")


class LegalContext(TranslationContext):
    defined_terms: list[dict[str, str]] = Field(default_factory=list)
    parties: list[str] = Field(default_factory=list)


class AcademicContext(TranslationContext):
    key_concepts: list[dict[str, str]] = Field(default_factory=list)
    citation_style: str = Field(default="")
    field: str = Field(default="")


# Genre-specific prompt templates
_NAME_MAPPING_INSTRUCTION = (
    "Extract an explicit name->translation mapping table for all proper nouns, character names, "
    "place names. Each entry must have source_name, translated_name, and aliases (informal or "
    "abbreviated forms in the source text). These mappings are HARD CONSTRAINTS for translation."
)

_GENRE_PROMPTS = {
    "fiction": (
        "You are an expert literary analyst. Analyze this text and output a JSON object with these keys:\n"
        "- 'genre': 'fiction'\n"
        "- 'characters': list of dicts with 'name' and 'traits'\n"
        "- 'name_mappings': list of dicts with 'source_name', 'translated_name', 'aliases'\n"
        "- 'glossary': list of dicts with 'term' and 'definition' (locations/terms)\n"
        "- 'style_guide': string describing tone, formatting, perspective\n\n"
        f"{_NAME_MAPPING_INSTRUCTION}\n\n"
        "Do NOT output markdown. Only output raw, valid JSON."
    ),
    "technical": (
        "You are a technical documentation analyst. Analyze this text and output a JSON object with these keys:\n"
        "- 'genre': 'technical'\n"
        "- 'terminology': list of dicts with 'term' and 'definition'\n"
        "- 'abbreviations': list of dicts with 'abbr' and 'full_form'\n"
        "- 'domain': string describing the technical domain\n"
        "- 'name_mappings': list of dicts with 'source_name', 'translated_name', 'aliases'\n"
        "- 'glossary': list of dicts with 'term' and 'definition'\n"
        "- 'style_guide': string describing tone and formality\n\n"
        f"{_NAME_MAPPING_INSTRUCTION}\n\n"
        "Do NOT output markdown. Only output raw, valid JSON."
    ),
    "legal": (
        "You are a legal document analyst. Analyze this text and output a JSON object with these keys:\n"
        "- 'genre': 'legal'\n"
        "- 'defined_terms': list of dicts with 'term' and 'definition'\n"
        "- 'parties': list of party names\n"
        "- 'name_mappings': list of dicts with 'source_name', 'translated_name', 'aliases'\n"
        "- 'glossary': list of dicts with 'term' and 'definition'\n"
        "- 'style_guide': string describing clause structure and formality notes\n\n"
        f"{_NAME_MAPPING_INSTRUCTION}\n\n"
        "Do NOT output markdown. Only output raw, valid JSON."
    ),
    "academic": (
        "You are an academic text analyst. Analyze this text and output a JSON object with these keys:\n"
        "- 'genre': 'academic'\n"
        "- 'key_concepts': list of dicts with 'concept' and 'definition'\n"
        "- 'citation_style': string describing the citation format used\n"
        "- 'field': string describing the academic field\n"
        "- 'name_mappings': list of dicts with 'source_name', 'translated_name', 'aliases'\n"
        "- 'glossary': list of dicts with 'term' and 'definition'\n"
        "- 'style_guide': string describing tone and perspective\n\n"
        f"{_NAME_MAPPING_INSTRUCTION}\n\n"
        "Do NOT output markdown. Only output raw, valid JSON."
    ),
    "general": (
        "You are a document analyst. Analyze this text and output a JSON object with these keys:\n"
        "- 'genre': 'general'\n"
        "- 'name_mappings': list of dicts with 'source_name', 'translated_name', 'aliases'\n"
        "- 'glossary': list of dicts with 'term' and 'definition'\n"
        "- 'style_guide': string describing tone, formality, perspective\n\n"
        f"{_NAME_MAPPING_INSTRUCTION}\n\n"
        "Do NOT output markdown. Only output raw, valid JSON."
    ),
}


class ContextAgent:
    def __init__(self, db_session: Session, llm_client=None):
        self.db = db_session
        self.llm_client = llm_client

    def classify_genre(self, text_sample: str) -> str:
        """Classify document genre from a text sample (~2000 chars)."""
        system_prompt = (
            "You are a document classification expert. Classify the genre of this text. "
            "Respond with ONLY one of: fiction, technical, legal, academic, general"
        )
        sample = text_sample[:3000]
        raw = self.llm_client.generate(
            system_prompt=system_prompt,
            user_message=f"Classify this text:\n{sample}",
            max_tokens=500,
            temperature=0.1,
            json_mode=False,
        )
        genre = raw.strip().lower()
        valid_genres = {"fiction", "technical", "legal", "academic", "general"}
        if genre not in valid_genres:
            log.warning("context.genre_fallback", detected=genre)
            genre = "general"
        return genre

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=2, max=60),
        retry=retry_if_exception_type((LLMRateLimitError, LLMTransientError)),
        reraise=True,
    )
    def generate_context(self, text: str, genre: str) -> str:
        """Generate genre-specific translation context via LLM (second call)."""
        if not self.llm_client:
            return json.dumps({
                "genre": genre,
                "name_mappings": [],
                "glossary": [{"term": "Mock City", "definition": "Capital of the mock kingdom"}],
                "style_guide": "Mock Tone: Serious"
            })

        system_prompt = _GENRE_PROMPTS.get(genre, _GENRE_PROMPTS["general"])

        return self.llm_client.generate(
            system_prompt=system_prompt,
            user_message=f"Document Content:\n{text}",
            max_tokens=4096,
            temperature=0.3,
            json_mode=True,
        )

    def generate_translation_context(self, txt_path: str, doc_id: str) -> dict:
        """
        Reads the full text, classifies genre, generates genre-specific
        translation context, validates it, and saves to DB.
        """
        with open(txt_path, "r", encoding="utf-8") as f:
            full_text = f.read()

        provider = self.llm_client.config.provider if self.llm_client else "mock"
        log.info("context_agent.generating", doc_id=doc_id, provider=provider)

        # Step 1: Classify genre
        genre = "general"
        if self.llm_client:
            genre = self.classify_genre(full_text)
        log.info("context.genre_detected", doc_id=doc_id, genre=genre)

        # Step 2: Generate genre-specific context
        raw_json_str = self.generate_context(full_text, genre)

        # Try to parse and validate
        try:
            # Sometimes LLMs wrap in markdown anyway
            if raw_json_str.startswith("```json"):
                raw_json_str = raw_json_str[7:]
            if raw_json_str.endswith("```"):
                raw_json_str = raw_json_str[:-3]

            parsed_data = json.loads(raw_json_str)
            parsed_data["genre"] = genre  # Ensure genre is set
            validated_data = TranslationContext(**parsed_data).model_dump()
        except Exception as e:
            log.error("context_agent.parse_error", error=str(e), raw_json=raw_json_str[:500])
            raise

        # Save to DB (upsert to handle retries gracefully)
        existing = self.db.query(ProjectMetadata).filter_by(doc_id=doc_id).first()
        if existing:
            existing.world_bible_json = validated_data
            log.info("context_agent.upsert", doc_id=doc_id, action="updated_existing")
        else:
            metadata = ProjectMetadata(
                doc_id=doc_id,
                world_bible_json=validated_data
            )
            self.db.add(metadata)
        self.db.commit()

        log.info("context_agent.complete", doc_id=doc_id, genre=genre,
                 name_mappings=len(validated_data.get("name_mappings", [])))
        return validated_data

    # Backward-compatible alias
    generate_world_bible = generate_translation_context
