package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type llmKeyRepo struct {
	pool *pgxpool.Pool
}

// NewLLMKeyRepository returns an LLMKeyRepository backed by the given connection pool.
func NewLLMKeyRepository(pool *pgxpool.Pool) LLMKeyRepository {
	return &llmKeyRepo{pool: pool}
}

func (r *llmKeyRepo) Save(ctx context.Context, id, userID, provider, encryptedKey, keyHint string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO user_llm_keys (id, user_id, provider, encrypted_key, key_hint, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (user_id, provider)
		 DO UPDATE SET encrypted_key = $4, key_hint = $5, updated_at = $6`,
		id, userID, provider, encryptedKey, keyHint, time.Now(),
	)
	return err
}

func (r *llmKeyRepo) ListByUser(ctx context.Context, userID string) ([]SavedKeyInfo, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT provider, key_hint, updated_at FROM user_llm_keys WHERE user_id = $1 ORDER BY provider`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []SavedKeyInfo
	for rows.Next() {
		var k SavedKeyInfo
		var t time.Time
		if err := rows.Scan(&k.Provider, &k.KeyHint, &t); err != nil {
			return nil, err
		}
		k.UpdatedAt = t.Format(time.RFC3339)
		keys = append(keys, k)
	}

	return keys, nil
}

func (r *llmKeyRepo) Delete(ctx context.Context, userID, provider string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM user_llm_keys WHERE user_id = $1 AND provider = $2`,
		userID, provider,
	)
	return err
}

func (r *llmKeyRepo) GetEncryptedKey(ctx context.Context, userID, provider string) (string, error) {
	var encrypted string
	err := r.pool.QueryRow(ctx,
		`SELECT encrypted_key FROM user_llm_keys WHERE user_id = $1 AND provider = $2`,
		userID, provider,
	).Scan(&encrypted)
	if err != nil {
		return "", err
	}
	return encrypted, nil
}
