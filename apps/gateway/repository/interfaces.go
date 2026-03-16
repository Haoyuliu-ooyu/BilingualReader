package repository

import "context"

// DocumentMeta holds summary info for a document listing.
type DocumentMeta struct {
	ID           string `json:"id"`
	OriginalName string `json:"original_name"`
	TargetLang   string `json:"target_lang"`
	Status       string `json:"status"`
	LLMProvider  string `json:"llm_provider,omitempty"`
	LLMModel     string `json:"llm_model,omitempty"`
	CreatedAt    string `json:"created_at"`
}

// SavedKeyInfo holds non-secret metadata about a stored LLM key.
type SavedKeyInfo struct {
	Provider  string `json:"provider"`
	KeyHint   string `json:"key_hint"`
	UpdatedAt string `json:"updated_at"`
}

// Block represents a single text segment on a page with its translation.
type Block struct {
	ID             string    `json:"id"`
	OriginalText   string    `json:"original_text"`
	TranslatedText string    `json:"translated_text,omitempty"`
	Bbox           []float64 `json:"bbox"`
}

// Page represents a document page with its text blocks.
type Page struct {
	PageNumber int     `json:"page_number"`
	Blocks     []Block `json:"blocks"`
}

// UserRepository defines data access for the users table.
type UserRepository interface {
	FindByEmail(ctx context.Context, email string) (id string, passwordHash string, err error)
	Create(ctx context.Context, id, email, passwordHash string) error
	ExistsByEmail(ctx context.Context, email string) (bool, error)
}

// DocumentRepository defines data access for the documents table.
type DocumentRepository interface {
	FindByIDAndUser(ctx context.Context, docID, userID string) (s3Key string, err error)
	ListByUser(ctx context.Context, userID string) ([]DocumentMeta, error)
	Create(ctx context.Context, id, userID, originalName, targetLang, s3Key, status, llmProvider, llmModel string) error
	Delete(ctx context.Context, docID string) error
	GetS3Key(ctx context.Context, docID, userID string) (string, error)
}

// LLMKeyRepository defines data access for the user_llm_keys table.
type LLMKeyRepository interface {
	Save(ctx context.Context, id, userID, provider, encryptedKey, keyHint string) error
	ListByUser(ctx context.Context, userID string) ([]SavedKeyInfo, error)
	Delete(ctx context.Context, userID, provider string) error
	GetEncryptedKey(ctx context.Context, userID, provider string) (string, error)
}

// PageRepository defines data access for pages, segments, and translations.
type PageRepository interface {
	GetDocumentTree(ctx context.Context, docID string) ([]Page, error)
}

// HealthRepository defines health-check probes for infrastructure dependencies.
type HealthRepository interface {
	PingDB(ctx context.Context) error
	PingRedis(ctx context.Context) error
	PingS3(ctx context.Context) error
}
