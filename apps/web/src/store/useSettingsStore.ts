import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LLMProvider = 'openai' | 'gemini' | 'claude'

interface SettingsState {
    draftKeys: Partial<Record<LLMProvider, string>>
    setDraftKey: (provider: LLMProvider, key: string) => void
    clearDraft: (provider: LLMProvider) => void
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            draftKeys: {},

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
        }),
        {
            name: 'bilingual-reader-settings',
            partialize: (state) => ({
                draftKeys: state.draftKeys,
            }),
        }
    )
)

export const PROVIDER_META: Record<LLMProvider, { label: string; placeholder: string }> = {
    openai: { label: 'OpenAI', placeholder: 'sk-...' },
    gemini: { label: 'Google Gemini', placeholder: 'AIza...' },
    claude: { label: 'Anthropic Claude', placeholder: 'sk-ant-...' },
}
