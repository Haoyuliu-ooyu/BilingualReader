import { useAuthStore } from '@/store/useAuthStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

/**
 * Thin wrapper around fetch that:
 * 1. Prepends the API base URL
 * 2. Attaches the JWT Authorization header if logged in
 * 3. Auto-logs out on 401 responses
 */
export async function apiFetch(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const { token, logout } = useAuthStore.getState()

    const headers = new Headers(options.headers)

    if (token) {
        headers.set('Authorization', `Bearer ${token}`)
    }

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
    })

    if (res.status === 401) {
        logout()
        window.location.href = '/login'
    }

    return res
}

/**
 * Convenience: apiFetch that also parses the response as JSON.
 * Throws on non-OK responses with the error message from the server.
 */
export async function apiFetchJSON<T = unknown>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await apiFetch(path, options)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
    }
    return data as T
}
