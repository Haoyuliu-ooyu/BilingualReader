package repository

import (
	"context"
	"database/sql"
	"encoding/json"
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
		SELECT id, original_name, target_lang, status, llm_provider, llm_model, created_at,
		       pipeline_phase, translated_count, total_count, error_detail
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
		var targetLang, llmProvider, llmModel, pipelinePhase sql.NullString
		var translatedCount, totalCount sql.NullInt32
		var errorDetailBytes []byte

		if err := rows.Scan(&d.ID, &d.OriginalName, &targetLang, &d.Status, &llmProvider, &llmModel, &createdAt,
			&pipelinePhase, &translatedCount, &totalCount, &errorDetailBytes); err != nil {
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
		if pipelinePhase.Valid {
			d.PipelinePhase = pipelinePhase.String
		}
		if translatedCount.Valid {
			d.TranslatedCount = int(translatedCount.Int32)
		}
		if totalCount.Valid {
			d.TotalCount = int(totalCount.Int32)
		}
		if len(errorDetailBytes) > 0 {
			d.ErrorDetail = json.RawMessage(errorDetailBytes)
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

func (r *documentRepo) GetDocumentForRetry(ctx context.Context, docID, userID string) (DocumentMeta, string, error) {
	var d DocumentMeta
	var s3Key string
	var targetLang, llmProvider, llmModel, pipelinePhase sql.NullString
	err := r.pool.QueryRow(ctx,
		`SELECT id, original_name, target_lang, status, llm_provider, llm_model, s3_key, pipeline_phase
		 FROM documents WHERE id = $1 AND user_id = $2`, docID, userID,
	).Scan(&d.ID, &d.OriginalName, &targetLang, &d.Status, &llmProvider, &llmModel, &s3Key, &pipelinePhase)
	if err != nil {
		return DocumentMeta{}, "", err
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
	if pipelinePhase.Valid {
		d.PipelinePhase = pipelinePhase.String
	}
	return d, s3Key, nil
}

func (r *documentRepo) ResetForRetry(ctx context.Context, docID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Delete child rows from previous attempt (CASCADE handles segments/translations via pages)
	if _, err := tx.Exec(ctx, `DELETE FROM project_metadata WHERE doc_id = $1`, docID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM pages WHERE doc_id = $1`, docID); err != nil {
		return err
	}

	// Reset document status for fresh processing
	if _, err := tx.Exec(ctx,
		`UPDATE documents SET status = 'PENDING', pipeline_phase = NULL, translated_count = 0, total_count = 0, error_detail = NULL WHERE id = $1`, docID,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
