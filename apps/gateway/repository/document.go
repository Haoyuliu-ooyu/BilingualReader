package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type documentRepo struct {
	pool *pgxpool.Pool
}

// NewDocumentRepository returns a DocumentRepository backed by the given connection pool.
func NewDocumentRepository(pool *pgxpool.Pool) DocumentRepository {
	return &documentRepo{pool: pool}
}

func (r *documentRepo) FindByIDAndUser(ctx context.Context, docID, userID string) (string, error) {
	var s3Key string
	err := r.pool.QueryRow(ctx,
		"SELECT s3_key FROM documents WHERE id = $1 AND user_id = $2", docID, userID,
	).Scan(&s3Key)
	if err != nil {
		return "", err
	}
	return s3Key, nil
}

func (r *documentRepo) ListByUser(ctx context.Context, userID string) ([]DocumentMeta, error) {
	query := `
		SELECT id, original_name, target_lang, status, llm_provider, llm_model, created_at
		FROM documents
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []DocumentMeta
	for rows.Next() {
		var d DocumentMeta
		var createdAt sql.NullTime
		var targetLang, llmProvider, llmModel sql.NullString

		if err := rows.Scan(&d.ID, &d.OriginalName, &targetLang, &d.Status, &llmProvider, &llmModel, &createdAt); err != nil {
			return nil, err
		}
		if createdAt.Valid {
			d.CreatedAt = createdAt.Time.Format(time.RFC3339)
		}
		if targetLang.Valid {
			d.TargetLang = targetLang.String
		}
		if llmProvider.Valid {
			d.LLMProvider = llmProvider.String
		}
		if llmModel.Valid {
			d.LLMModel = llmModel.String
		}
		docs = append(docs, d)
	}

	return docs, nil
}

func (r *documentRepo) Create(ctx context.Context, id, userID, originalName, targetLang, s3Key, status, llmProvider, llmModel string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO documents (id, user_id, original_name, target_lang, s3_key, status, llm_provider, llm_model, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		id, userID, originalName, targetLang, s3Key, status, llmProvider, llmModel, time.Now(),
	)
	return err
}

func (r *documentRepo) Delete(ctx context.Context, docID string) error {
	_, err := r.pool.Exec(ctx,
		"DELETE FROM documents WHERE id = $1", docID,
	)
	return err
}

func (r *documentRepo) GetS3Key(ctx context.Context, docID, userID string) (string, error) {
	var s3Key string
	err := r.pool.QueryRow(ctx,
		"SELECT s3_key FROM documents WHERE id = $1 AND user_id = $2", docID, userID,
	).Scan(&s3Key)
	if err != nil {
		return "", err
	}
	return s3Key, nil
}
