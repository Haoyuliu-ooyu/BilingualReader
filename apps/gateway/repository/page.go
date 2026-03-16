package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
)

type pageRepo struct {
	pool *pgxpool.Pool
}

// NewPageRepository returns a PageRepository backed by the given connection pool.
func NewPageRepository(pool *pgxpool.Pool) PageRepository {
	return &pageRepo{pool: pool}
}

func (r *pageRepo) GetDocumentTree(ctx context.Context, docID string) ([]Page, error) {
	// Query pages
	pagesRows, err := r.pool.Query(ctx,
		"SELECT page_id, page_number FROM pages WHERE doc_id = $1 ORDER BY page_number ASC", docID,
	)
	if err != nil {
		return nil, err
	}
	defer pagesRows.Close()

	var pages []Page

	for pagesRows.Next() {
		var pageID string
		var pageNum int
		if err := pagesRows.Scan(&pageID, &pageNum); err != nil {
			return nil, err
		}

		page := Page{PageNumber: pageNum, Blocks: []Block{}}

		// Query segments + translations for this page
		query := `
			SELECT s.seg_id, s.original_text, s.bbox, t.translated_text
			FROM source_segments s
			LEFT JOIN translations t ON s.seg_id = t.seg_id
			WHERE s.page_id = $1
			ORDER BY s.block_index ASC
		`

		segRows, err := r.pool.Query(ctx, query, pageID)
		if err != nil {
			return nil, err
		}

		for segRows.Next() {
			var b Block
			var bboxJSON []byte
			var transText sql.NullString

			if err := segRows.Scan(&b.ID, &b.OriginalText, &bboxJSON, &transText); err != nil {
				segRows.Close()
				return nil, err
			}
			if err := json.Unmarshal(bboxJSON, &b.Bbox); err != nil {
				segRows.Close()
				return nil, err
			}

			if transText.Valid {
				b.TranslatedText = transText.String
			}

			page.Blocks = append(page.Blocks, b)
		}
		segRows.Close()

		pages = append(pages, page)
	}

	return pages, nil
}
