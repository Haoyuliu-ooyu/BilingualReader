interface ErrorDetail {
  code: string
  message: string
}

const ERROR_MESSAGES: Record<string, string> = {
  LLM_AUTH_FAILED: 'Invalid API key. Check your key in Settings.',
  LLM_RATE_LIMITED: 'Rate limit exceeded. Wait a moment and retry.',
  LLM_CONTENT_POLICY: "Some content was blocked by the AI provider's safety filters.",
  PIPELINE_ERROR: 'Translation failed due to an internal error.',
}

export function getErrorMessage(errorDetail?: ErrorDetail | null): string {
  if (!errorDetail) return 'Translation failed. Try again or contact support.'
  return ERROR_MESSAGES[errorDetail.code] || errorDetail.message || 'Translation failed. Try again or contact support.'
}
