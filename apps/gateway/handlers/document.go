package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"gateway/services"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
)

type DocumentHandler struct {
	DB      *services.DBService
	Storage *services.StorageService
}

// Structs matching the frontend UI requirements
type Block struct {
	ID             string    `json:"id"`
	OriginalText   string    `json:"original_text"`
	TranslatedText string    `json:"translated_text,omitempty"`
	Bbox           []float64 `json:"bbox"` // [x0, y0, x1, y1]
}

type Page struct {
	PageNumber int     `json:"page_number"`
	Blocks     []Block `json:"blocks"`
}

type DocumentMeta struct {
	ID           string `json:"id"`
	OriginalName string `json:"original_name"`
	TargetLang   string `json:"target_lang"`
	Status       string `json:"status"`
	LLMProvider  string `json:"llm_provider,omitempty"`
	LLMModel     string `json:"llm_model,omitempty"`
	CreatedAt    string `json:"created_at"`
}

func (h *DocumentHandler) GetDocumentTree(c *gin.Context) {
	docID := c.Param("id")
	userID := c.GetString("userID")
	ctx := c.Request.Context()

	// 1. Verify document exists AND belongs to the current user
	var s3Key string
	err := h.DB.Pool.QueryRow(ctx, "SELECT s3_key FROM documents WHERE id = $1 AND user_id = $2", docID, userID).Scan(&s3Key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	// 2. Query Pages
	pagesRows, err := h.DB.Pool.Query(ctx, "SELECT page_id, page_number FROM pages WHERE doc_id = $1 ORDER BY page_number ASC", docID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query pages"})
		return
	}
	defer pagesRows.Close()

	var pages []Page

	for pagesRows.Next() {
		var pageID string
		var pageNum int
		if err := pagesRows.Scan(&pageID, &pageNum); err != nil {
			continue
		}

		page := Page{PageNumber: pageNum, Blocks: []Block{}}

		// 3. Query Segments + Translations for this page
		query := `
			SELECT s.seg_id, s.original_text, s.bbox, t.translated_text
			FROM source_segments s
			LEFT JOIN translations t ON s.seg_id = t.seg_id
			WHERE s.page_id = $1
			ORDER BY s.block_index ASC
		`

		segRows, err := h.DB.Pool.Query(ctx, query, pageID)
		if err == nil {
			for segRows.Next() {
				var b Block
				var bboxJSON []byte
				var transText sql.NullString

				if err := segRows.Scan(&b.ID, &b.OriginalText, &bboxJSON, &transText); err == nil {
					json.Unmarshal(bboxJSON, &b.Bbox)

					if transText.Valid {
						b.TranslatedText = transText.String
					}

					page.Blocks = append(page.Blocks, b)
				}
			}
			segRows.Close()
		}

		pages = append(pages, page)
	}

	c.JSON(http.StatusOK, pages)
}

func (h *DocumentHandler) GetDocumentPDF(c *gin.Context) {
	docID := c.Param("id")
	userID := c.GetString("userID")
	ctx := c.Request.Context()

	var s3Key string
	err := h.DB.Pool.QueryRow(ctx, "SELECT s3_key FROM documents WHERE id = $1 AND user_id = $2", docID, userID).Scan(&s3Key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	// Fetch from S3
	out, err := h.Storage.Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(h.Storage.Bucket),
		Key:    aws.String(s3Key),
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch PDF from storage"})
		return
	}
	defer out.Body.Close()

	// Stream directly to client
	c.DataFromReader(http.StatusOK, *out.ContentLength, "application/pdf", out.Body, map[string]string{
		"Content-Disposition": fmt.Sprintf("inline; filename=\"%s.pdf\"", docID),
	})
}

func (h *DocumentHandler) GetDocumentsList(c *gin.Context) {
	userID := c.GetString("userID")
	ctx := c.Request.Context()

	// Only return documents owned by the authenticated user
	query := `
		SELECT id, original_name, target_lang, status, llm_provider, llm_model, created_at
		FROM documents
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := h.DB.Pool.Query(ctx, query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch documents list"})
		return
	}
	defer rows.Close()

	var docs []DocumentMeta
	for rows.Next() {
		var d DocumentMeta
		var createdAt sql.NullTime
		var targetLang, llmProvider, llmModel sql.NullString

		if err := rows.Scan(&d.ID, &d.OriginalName, &targetLang, &d.Status, &llmProvider, &llmModel, &createdAt); err == nil {
			if createdAt.Valid {
				d.CreatedAt = createdAt.Time.Format("2006-01-02T15:04:05Z")
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
	}

	c.JSON(http.StatusOK, docs)
}

func (h *DocumentHandler) DeleteDocument(c *gin.Context) {
	docID := c.Param("id")
	userID := c.GetString("userID")
	ctx := c.Request.Context()

	// 1. Get S3 Key — only if the document belongs to the current user
	var s3Key string
	err := h.DB.Pool.QueryRow(ctx, "SELECT s3_key FROM documents WHERE id = $1 AND user_id = $2", docID, userID).Scan(&s3Key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	// 2. Delete from S3
	_, err = h.Storage.Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(h.Storage.Bucket),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		fmt.Printf("Warning: Failed to delete S3 file %s: %v\n", s3Key, err)
	}

	// 3. Delete from DB (cascading manually)
	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start database transaction"})
		return
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		DELETE FROM translations WHERE seg_id IN (
			SELECT seg_id FROM source_segments WHERE page_id IN (
				SELECT page_id FROM pages WHERE doc_id = $1
			)
		)`, docID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete translations"})
		return
	}

	_, err = tx.Exec(ctx, `
		DELETE FROM source_segments WHERE page_id IN (
			SELECT page_id FROM pages WHERE doc_id = $1
		)`, docID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete segments"})
		return
	}

	_, err = tx.Exec(ctx, "DELETE FROM pages WHERE doc_id = $1", docID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete pages"})
		return
	}

	_, err = tx.Exec(ctx, "DELETE FROM documents WHERE id = $1", docID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete document metadata"})
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit database deletion"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Document deleted successfully"})
}
