ALTER TABLE documents DROP COLUMN IF EXISTS pipeline_phase;
ALTER TABLE documents DROP COLUMN IF EXISTS translated_count;
ALTER TABLE documents DROP COLUMN IF EXISTS total_count;
ALTER TABLE documents DROP COLUMN IF EXISTS error_detail;
