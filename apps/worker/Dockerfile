FROM python:3.11-slim

WORKDIR /app

# Install Tesseract OCR with language packs for text extraction fallback
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-chi-sim \
    tesseract-ocr-chi-tra \
    tesseract-ocr-jpn \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements if they exist, otherwise skip
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

COPY . .

CMD ["python", "main.py"]
