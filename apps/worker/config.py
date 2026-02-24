import os

class Config:
    REDIS_ADDR = os.getenv("REDIS_ADDR", "localhost:6379")
    DB_URL = os.getenv("DB_URL", "postgres://postgres:prism@localhost:5432/prism")
    S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
    S3_REGION = os.getenv("S3_REGION", "us-east-1")
    S3_BUCKET = os.getenv("S3_BUCKET", "raw-documents")
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "minioadmin")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
