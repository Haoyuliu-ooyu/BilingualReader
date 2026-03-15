import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch } from '@/lib/api'

export type LLMProvider = 'openai' | 'gemini' | 'claude'

export interface SavedKeyInfo {
    provider: LLMProvider
    key_hint: string
    updated_at: string
}

interface SettingsState {
    // Server-saved keys (provider -> hint like "...abcd")
    savedKeys: SavedKeyInfo[]
    // Local draft keys being edited (not yet saved to server)
    draftKeys: Partial<Record<LLMProvider, string>>

    fetchSavedKeys: () => Promise<void>
    saveKey: (provider: LLMProvider, key: string) => Promise<void>
    removeKey: (provider: LLMProvider) => Promise<void>
    setDraftKey: (provider: LLMProvider, key: string) => void
    clearDraft: (provider: LLMProvider) => void
    getSavedProviders: () => LLMProvider[]
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            savedKeys: [],
            draftKeys: {},

            fetchSavedKeys: async () => {
                try {
                    const res = await apiFetch('/api/llm-keys')
                    if (res.ok) {
                        const data = await res.json()
                        set({ savedKeys: data.keys || [] })
                    }
                } catch {
                    // ignore network errors
                }
            },

            saveKey: async (provider, key) => {
                const res = await apiFetch('/api/llm-keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider, api_key: key }),
                })
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error((data as { error?: string }).error || 'Failed to save key')
                }
                // Clear draft and refresh saved keys
                const next = { ...get().draftKeys }
                delete next[provider]
                set({ draftKeys: next })
                await get().fetchSavedKeys()
            },

            removeKey: async (provider) => {
                const res = await apiFetch(`/api/llm-keys/${provider}`, { method: 'DELETE' })
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error((data as { error?: string }).error || 'Failed to remove key')
                }
                await get().fetchSavedKeys()
            },

            setDraftKey: (provider, key) =>
                set((state) => ({
                    draftKeys: { ...state.draftKeys, [provider]: key },
                })),

            clearDraft: (provider) =>
                set((state) => {
                    const next = { ...state.draftKeys }
                    delete next[provider]
                    return { draftKeys: next }
                }),

            getSavedProviders: () => {
                return get().savedKeys.map((k) => k.provider)
            },
        }),
        {
            name: 'bilingual-reader-settings',
            partialize: (state) => ({
                // Only persist savedKeys locally for quick display before server fetch
                savedKeys: state.savedKeys,
            }),
        }
    )
)

export const PROVIDER_META: Record<LLMProvider, { label: string; placeholder: string }> = {
    openai: { label: 'OpenAI', placeholder: 'sk-...' },
    gemini: { label: 'Google Gemini', placeholder: 'AIza...' },
    claude: { label: 'Anthropic Claude', placeholder: 'sk-ant-...' },
}
