import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetchJSON, apiFetch } from '@/lib/api'
import { queryKeys, type DocumentMeta } from '@/lib/queries'
import type { LLMProvider } from '@/store/useSettingsStore'

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetchJSON(`/api/documents/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.documents.list() })
      const previous = queryClient.getQueryData<DocumentMeta[]>(queryKeys.documents.list())
      queryClient.setQueryData<DocumentMeta[]>(queryKeys.documents.list(), (old) =>
        old?.filter(d => d.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(queryKeys.documents.list(), context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.list() })
    },
  })
}

export function useRetryDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetchJSON(`/api/documents/${id}/retry`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.list() })
    },
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { file: File; targetLang: string; llmProvider: string; llmModel: string }) => {
      const formData = new FormData()
      formData.append('target_lang', params.targetLang)
      formData.append('file', params.file)
      formData.append('llm_provider', params.llmProvider)
      formData.append('llm_model', params.llmModel)
      return apiFetchJSON<{ job_id: string }>(`/api/upload?target_lang=${encodeURIComponent(params.targetLang)}`, {
        method: 'POST',
        body: formData,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.list() })
    },
  })
}

export function useSaveKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { provider: LLMProvider; apiKey: string }) =>
      apiFetchJSON('/api/llm-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: params.provider, api_key: params.apiKey }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.llmKeys.list() })
    },
  })
}

export function useRemoveKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (provider: LLMProvider) =>
      apiFetchJSON(`/api/llm-keys/${provider}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.llmKeys.list() })
    },
  })
}
