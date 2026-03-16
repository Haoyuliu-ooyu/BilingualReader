CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY,
    user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
    original_name TEXT,
    s3_key        TEXT,
    status        TEXT,
    target_lang   TEXT,
    result        JSONB,
    llm_provider  TEXT,
    llm_model     TEXT,
    created_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_llm_keys (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    key_hint      TEXT NOT NULL DEFAULT '',
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS project_metadata (
    meta_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id           TEXT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    world_bible_json JSONB
);

CREATE TABLE IF NOT EXISTS pages (
    page_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id      TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    width       DOUBLE PRECISION NOT NULL,
    height      DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS source_segments (
    seg_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id     UUID NOT NULL REFERENCES pages(page_id) ON DELETE CASCADE,
    block_index INTEGER NOT NULL,
    original_text TEXT NOT NULL,
    bbox        JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS translations (
    trans_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seg_id          UUID NOT NULL REFERENCES source_segments(seg_id) ON DELETE CASCADE,
    target_language TEXT NOT NULL,
    translated_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_doc_id ON pages(doc_id);
CREATE INDEX IF NOT EXISTS idx_source_segments_page_id ON source_segments(page_id);
CREATE INDEX IF NOT EXISTS idx_translations_seg_id ON translations(seg_id);
CREATE INDEX IF NOT EXISTS idx_user_llm_keys_user_provider ON user_llm_keys(user_id, provider);
