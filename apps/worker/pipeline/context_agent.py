import json
import os
from google import genai
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from sqlalchemy.orm import Session
from .models import ProjectMetadata

from typing import Union, List

# Define the expected JSON output structure using Pydantic
class WorldBible(BaseModel):
    characters: list[dict[str, Union[str, List[str]]]] = Field(description="List of characters with name and traits.")
    glossary: list[dict[str, Union[str, List[str]]]] = Field(description="List of key terms or locations and their definitions.")
    style_guide: str = Field(description="Brief description of tone, formatting, and perspective.")

class ContextAgent:
    def __init__(self, db_session: Session):
        self.db = db_session
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None
            print("Warning: GEMINI_API_KEY not set. Generating mock Context Agent data.")
        
        self.model_name = "gemini-3-flash-preview"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True
    )
    def call_gemini(self, text: str) -> str:
        
        if not self.client:
             return json.dumps({
                "characters": [{"name": "Mock Character", "traits": "Brave"}],
                "glossary": [{"term": "Mock City", "definition": "Capital of the mock kingdom"}],
                "style_guide": "Mock Tone: Serious"
             })
             
        prompt = (
            "You are an expert literary analyst. Read this entire book and output a JSON object "
            "with exactly three keys: 'characters' (list of dictionaries with keys 'name' and 'traits'), "
            "'glossary' (list of dictionaries with keys 'term' and 'definition' (for locations/terms)), "
            "and 'style_guide' (a string with a brief description of tone, formatting, and perspective). "
            "Do NOT output markdown (like ```json). Only output the raw, valid JSON.\n\n"
            f"Book Content:\n{text}"
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt
        )
        return response.text.strip()

    def generate_world_bible(self, txt_path: str, doc_id: str) -> dict:
        """
        Reads the full text, calls Gemini to get the World Bible, 
        validates it with Pydantic, and saves to DB.
        """
        with open(txt_path, "r", encoding="utf-8") as f:
            full_text = f.read()

        print(f"Generating World Bible for {doc_id} using Gemini...")
        
        raw_json_str = self.call_gemini(full_text)
        
        # Try to parse and validate
        try:
            # Sometimes LLMs wrap in markdown anyway
            if raw_json_str.startswith("```json"):
                raw_json_str = raw_json_str[7:]
            if raw_json_str.endswith("```"):
                raw_json_str = raw_json_str[:-3]
                
            parsed_data = json.loads(raw_json_str)
            validated_data = WorldBible(**parsed_data).model_dump()
        except Exception as e:
            print(f"Failed to parse or validate Gemini output: {e}\nRaw JSON: {raw_json_str}")
            raise

        # Save to DB
        metadata = ProjectMetadata(
            doc_id=doc_id,
            world_bible_json=validated_data
        )
        self.db.add(metadata)
        self.db.commit()
        
        print("World Bible generated and saved.")
        return validated_data
