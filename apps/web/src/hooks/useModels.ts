import { useState, useEffect, useRef } from 'react'
import type { LLMProvider } from '@/store/useSettingsStore'
import { apiFetch } from '@/lib/api'

export interface ModelInfo {
    id: string
    name: string
}

/**
 * Fetches available models from the gateway's /api/models proxy.
 * The server uses the user's saved API key for the given provider.
 * Caches results per provider so we don't re-fetch on every render.
 */
export function useModels(provider: LLMProvider | null) {
    const [models, setModels] = useState<ModelInfo[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const cache = useRef<Record<string, ModelInfo[]>>({})

    useEffect(() => {
        if (!provider) {
            setModels([])
            return
        }

        if (cache.current[provider]) {
            setModels(cache.current[provider])
            return
        }

        let cancelled = false
        setLoading(true)
        setError(null)

        apiFetch('/api/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error((data as { error?: string }).error || `Failed to fetch models (${res.status})`)
                }
                return res.json()
            })
            .then((data) => {
                if (cancelled) return
                const list: ModelInfo[] = data.models || []
                cache.current[provider] = list
                setModels(list)
            })
            .catch((err) => {
                if (cancelled) return
                setError(err.message)
                setModels([])
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => { cancelled = true }
    }, [provider])

    return { models, loading, error }
}
