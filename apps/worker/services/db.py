import psycopg2
import time

class DBService:
    def __init__(self, db_url):
        self.db_url = db_url
        self.conn = None
        self.connect()

    def connect(self):
        retries = 5
        while retries > 0:
            try:
                self.conn = psycopg2.connect(self.db_url)
                self.conn.autocommit = True
                print("Connected to Postgres")
                return
            except Exception as e:
                print(f"Failed to connect to DB: {e}. Retrying in 2s...")
                retries -= 1
                time.sleep(2)
        raise Exception("Could not connect to Postgres")

    def update_job_status(self, job_id, status):
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "UPDATE documents SET status = %s WHERE id = %s",
                    (status, job_id)
                )
        except Exception as e:
            print(f"Error updating job status: {e}")
            # Try reconnecting
            self.connect()

    def save_translation(self, job_id, translation_json):
        # We need a table for translations or update documents. 
        # For now let's assume we update a jsonb column 'result' in documents table
        # or separate table. The specs say "Store: Worker saves structured TranslationMap JSON to Postgres"
        # B. The Translation Output (JSONB in Postgres)
        try:
            with self.conn.cursor() as cur:
                 cur.execute(
                    "UPDATE documents SET result = %s, status = 'COMPLETED' WHERE id = %s",
                    (translation_json, job_id)
                )
        except Exception as e:
            print(f"Error saving translation: {e}")
            self.connect()
