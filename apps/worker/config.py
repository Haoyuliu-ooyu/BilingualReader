import os

class Config:
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    QUEUE_DRIVER = os.getenv("QUEUE_DRIVER", "redis")
    SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL", "")
    SQS_REGION = os.getenv("S3_REGION", "us-east-1")  # reuse S3_REGION
    DB_URL = os.getenv("DB_URL", "postgres://postgres:prism@localhost:5432/prism")
    S3_ENDPOINT = os.getenv("S3_ENDPOINT") or None
    S3_REGION = os.getenv("S3_REGION", "us-east-1")
    S3_BUCKET = os.getenv("S3_BUCKET", "raw-documents")
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID") or None
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY") or None

