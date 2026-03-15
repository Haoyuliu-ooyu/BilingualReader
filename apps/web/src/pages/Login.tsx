import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, Loader2 } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export default function Login() {
    const [isRegister, setIsRegister] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const login = useAuthStore((s) => s.login)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            const data = await res.json().catch(() => ({}))

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed')
            }

            login(data.token, data.user)
            navigate('/', { replace: true })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-sm space-y-8">
                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            Bilingual Reader
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Read in another language like a blast with AI.
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle>{isRegister ? 'Create Account' : 'Welcome Back'}</CardTitle>
                        <CardDescription>
                            {isRegister
                                ? 'Enter your email and a password to get started.'
                                : 'Sign in to your account to continue.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label htmlFor="email" className="text-sm font-medium">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    autoComplete="email"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="password" className="text-sm font-medium">Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {isRegister ? 'Creating account...' : 'Signing in...'}
                                    </>
                                ) : (
                                    isRegister ? 'Create Account' : 'Sign In'
                                )}
                            </Button>

                            <div className="text-center text-sm text-muted-foreground">
                                {isRegister ? (
                                    <>
                                        Already have an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => { setIsRegister(false); setError(null) }}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            Sign in
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        Don't have an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => { setIsRegister(true); setError(null) }}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            Create one
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
