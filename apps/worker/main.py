import sys
import time
import json
import os
from config import Config
from services.db import DBService
from services.queue import QueueService
# Import nodes
from nodes.parser import parse_pdf
from nodes.translator import translate_text

# Helper to download file from S3 (using boto3 directly or service)
import boto3

def download_file(s3_key, local_path):
    s3 = boto3.client('s3',
        endpoint_url=Config.S3_ENDPOINT,
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        region_name=Config.S3_REGION
    )
    try:
        s3.download_file(Config.S3_BUCKET, s3_key, local_path)
        return True
    except Exception as e:
        print(f"Failed to download {s3_key}: {e}")
        return False

def main():
    print("Worker Service Starting...", flush=True)
    
    # Initialize Services
    try:
        db = DBService(Config.DB_URL)
        queue = QueueService(Config.REDIS_ADDR)
    except Exception as e:
        print(f"Initialization Failed: {e}", flush=True)
        # retry logic or exit
        time.sleep(5)
        sys.exit(1)

    print("Worker Ready to Process Jobs from tasks:process_pdf", flush=True)
    
    while True:
        try:
            task = queue.get_task("tasks:process_pdf", timeout=5)
            
            if task:
                print(f"Received Job: {task.get('job_id')}", flush=True)
                process_task(db, task)
            else:
                pass
                
        except Exception as e:
            print(f"Worker Loop Error: {e}", flush=True)
            time.sleep(1)

def process_task(db, task):
    job_id = task.get('job_id')
    s3_key = task.get('s3_key')
    target_lang = task.get('target_lang', 'ES')
    
    try:
        # Update Status to PROCESSING
        db.update_job_status(job_id, "PROCESSING")
        
        # 1. Download PDF
        local_pdf_path = f"/tmp/{job_id}.pdf"
        print(f"Downloading {s3_key} to {local_pdf_path}...", flush=True)
        if not download_file(s3_key, local_pdf_path):
            raise Exception("Download failed")
            
        # 2. Parse PDF
        print(f"Parsing PDF...", flush=True)
        pages = parse_pdf(local_pdf_path)
        
        # 3. Translate Blocks
        print(f"Translating to {target_lang}...", flush=True)
        for page in pages:
            for block in page['blocks']:
                # Simple optimization: only translate if text is long enough
                if len(block['text']) > 2:
                    block['translated_text'] = translate_text(block['text'], target_lang)
                else:
                    block['translated_text'] = block['text']
                    
                # Mock term extraction for now
                if "mitochondria" in block['text'].lower():
                    block['terms'] = [{"term": "mitochondria", "definition": "Powerhouse of the cell"}]

        # 4. Save Result
        result_json = json.dumps({
            "job_id": job_id,
            "pages": pages
        })
        
        db.save_translation(job_id, result_json)
        
        # Cleanup
        if os.path.exists(local_pdf_path):
            os.remove(local_pdf_path)
            
        print(f"Job {job_id} Completed.", flush=True)
        
    except Exception as e:
        print(f"Error processing job {job_id}: {e}", flush=True)
        db.update_job_status(job_id, "FAILED")

if __name__ == "__main__":
    main()
