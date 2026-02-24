import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# simple translator using OpenAI
def translate_text(text, target_lang="ES"):
    """
    Translates text to target language while preserving context.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Warning: OPENAI_API_KEY not set. Returning mock translation.")
        return f"[MOCK {target_lang}] {text}"

    llm = ChatOpenAI(model="gpt-4o", temperature=0.3)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You remain a helpful translator. Translate the following text to {lang}. Preserve any formatting if possible."),
        ("user", "{text}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    try:
        return chain.invoke({"lang": target_lang, "text": text})
    except Exception as e:
        print(f"Translation error: {e}")
        return text

if __name__ == "__main__":
    print(translate_text("Hello world", "ZH"))
