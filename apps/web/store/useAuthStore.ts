import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
    id: string
    email: string
}

interface AuthState {
    token: string | null
    user: User | null
    login: (token: string, user: User) => void
    logout: () => void
    isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,

            login: (token, user) => set({ token, user }),

            logout: () => set({ token: null, user: null }),

            isAuthenticated: () => {
                const { token } = get()
                return token !== null && token.length > 0
            },
        }),
        { name: 'bilingual-reader-auth' }
    )
)
