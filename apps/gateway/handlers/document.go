package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"gateway/services"
)

// DocumentHandler handles document-related endpoints.
type DocumentHandler struct {
	docService services.DocumentService
	logger     *zap.Logger
}

// NewDocumentHandler creates a new DocumentHandler.
func NewDocumentHandler(docSvc services.DocumentService, logger *zap.Logger) *DocumentHandler {
	return &DocumentHandler{docService: docSvc, logger: logger}
}

// GetDocumentTree returns the page/block/translation tree for a document.
func (h *DocumentHandler) GetDocumentTree(c *gin.Context) {
	docID := c.Param("id")
	userID := c.GetString("userID")

	pages, err := h.docService.GetTree(c.Request.Context(), docID, userID)
	if err != nil {
		h.logger.Warn("failed to get document tree", zap.String("doc_id", docID), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	c.JSON(http.StatusOK, pages)
}

// GetDocumentsList returns all documents for the authenticated user.
func (h *DocumentHandler) GetDocumentsList(c *gin.Context) {
	userID := c.GetString("userID")

	docs, err := h.docService.List(c.Request.Context(), userID)
	if err != nil {
		h.logger.Error("failed to list documents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch documents list"})
		return
	}

	c.JSON(http.StatusOK, docs)
}

// GetDocumentPDF streams the original PDF from S3 to the client.
func (h *DocumentHandler) GetDocumentPDF(c *gin.Context) {
	docID := c.Param("id")
	userID := c.GetString("userID")

	body, contentLength, err := h.docService.GetPDFStream(c.Request.Context(), docID, userID)
	if err != nil {
		h.logger.Warn("failed to get document PDF", zap.String("doc_id", docID), zap.Error(err))
		if err.Error() == "document not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch PDF from storage"})
		return
	}
	defer body.Close()

	c.DataFromReader(http.StatusOK, contentLength, "application/pdf", body, map[string]string{
		"Content-Disposition": fmt.Sprintf("inline; filename=\"%s.pdf\"", docID),
	})
}

// DeleteDocument removes a document and its S3 object.
func (h *DocumentHandler) DeleteDocument(c *gin.Context) {
	docID := c.Param("id")
	userID := c.GetString("userID")

	err := h.docService.Delete(c.Request.Context(), docID, userID)
	if err != nil {
		h.logger.Warn("failed to delete document", zap.String("doc_id", docID), zap.Error(err))
		if err.Error() == "document not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete document"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Document deleted successfully"})
}
