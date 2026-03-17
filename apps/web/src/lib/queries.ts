import { apiFetchJSON, apiFetch } from '@/lib/api'
import type { LLMProvider } from '@/store/useSettingsStore'

// --- Types ---

export interface DocumentMeta {
  id: string
  original_name: string
  target_lang: string
  status: string
  llm_provider?: string
  llm_model?: string
  created_at: string
  pipeline_phase?: string
  translated_count: number
  total_count: number
  error_detail?: { code: string; message: string }
}

export interface ModelInfo {
  id: string
  name: string
}

export interface SavedKeyInfo {
  provider: LLMProvider
  key_hint: string
  updated_at: string
}

export interface Page {
  page_number: number
  blocks: Block[]
}

export interface Block {
  id: string
  original_text: string
  translated_text?: string
  bbox: number[]
}

// --- Query Keys ---

export const queryKeys = {
  documents: {
    all: ['documents'] as const,
    list: () => [...queryKeys.documents.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.documents.all, 'detail', id] as const,
    tree: (id: string) => [...queryKeys.documents.all, 'tree', id] as const,
    pdf: (id: string) => [...queryKeys.documents.all, 'pdf', id] as const,
  },
  llmKeys: {
    all: ['llm-keys'] as const,
    list: () => ['llm-keys', 'list'] as const,
  },
  models: {
    byProvider: (provider: string) => ['models', provider] as const,
  },
} as const

// --- Query Functions ---

export function fetchDocuments(): Promise<DocumentMeta[]> {
  return apiFetchJSON<DocumentMeta[]>('/api/documents').then(data => data || [])
}

export function fetchDocumentTree(id: string): Promise<Page[]> {
  return apiFetchJSON<Page[]>(`/api/documents/${id}`)
}

export async function fetchDocumentPDF(id: string): Promise<string> {
  const res = await apiFetch(`/api/documents/${id}/pdf`)
  if (!res.ok) throw new Error('Failed to fetch PDF')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export function fetchSavedKeys(): Promise<{ keys: SavedKeyInfo[] }> {
  return apiFetchJSON<{ keys: SavedKeyInfo[] }>('/api/llm-keys')
}

export async function fetchModels(provider: LLMProvider): Promise<ModelInfo[]> {
  const data = await apiFetchJSON<{ models: ModelInfo[] }>('/api/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  })
  return data.models || []
}

// --- Polling Helpers ---

const FINAL_STATES = new Set(['COMPLETED', 'FAILED'])

export function shouldPollDocuments(documents?: DocumentMeta[]): number | false {
  if (!documents) return false
  const hasPending = documents.some(d => !FINAL_STATES.has(d.status))
  return hasPending ? 3000 : false
}
