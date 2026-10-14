package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	if databaseURL == "" { return nil, fmt.Errorf("DATABASE_URL wajib diatur") }
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil { return nil, err }
	if err := pool.Ping(ctx); err != nil { pool.Close(); return nil, err }
	return pool, nil
}
