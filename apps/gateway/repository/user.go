package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type userRepo struct {
	pool *pgxpool.Pool
}

// NewUserRepository returns a UserRepository backed by the given connection pool.
func NewUserRepository(pool *pgxpool.Pool) UserRepository {
	return &userRepo{pool: pool}
}

func (r *userRepo) FindByEmail(ctx context.Context, email string) (string, string, error) {
	var id, passwordHash string
	err := r.pool.QueryRow(ctx,
		"SELECT id, password FROM users WHERE email = $1", email,
	).Scan(&id, &passwordHash)
	if err != nil {
		return "", "", err
	}
	return id, passwordHash, nil
}

func (r *userRepo) Create(ctx context.Context, id, email, passwordHash string) error {
	_, err := r.pool.Exec(ctx,
		"INSERT INTO users (id, email, password) VALUES ($1, $2, $3)",
		id, email, passwordHash,
	)
	return err
}

func (r *userRepo) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email,
	).Scan(&exists)
	return exists, err
}
