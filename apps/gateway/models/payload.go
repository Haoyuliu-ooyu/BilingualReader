package models

type JobPayload struct {
	JobID        string `json:"job_id"`
	UserID       string `json:"user_id"`
	S3Key        string `json:"s3_key"`
	OriginalName string `json:"original_name"`
	TargetLang   string `json:"target_lang"` // e.g., "ES", "ZH"
}
