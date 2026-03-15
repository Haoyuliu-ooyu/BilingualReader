import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useSettingsStore, PROVIDER_META, type LLMProvider } from '@/store/useSettingsStore'
import { useModels } from '@/hooks/useModels'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function FileUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [targetLang, setTargetLang] = useState('ES')
    const [selectedProvider, setSelectedProvider] = useState<LLMProvider | ''>('')
    const [selectedModel, setSelectedModel] = useState('')
    const navigate = useNavigate()

    const { savedKeys, fetchSavedKeys } = useSettingsStore()

    useEffect(() => {
        fetchSavedKeys()
    }, [fetchSavedKeys])

    const configuredProviders = savedKeys.map((k) => k.provider)

    // Auto-select if only one provider is configured
    const activeProvider = selectedProvider || (configuredProviders.length === 1 ? configuredProviders[0] : '')

    const { models, loading: modelsLoading, error: modelsError } = useModels(
        activeProvider as LLMProvider || null
    )

    const hasApiKeys = configuredProviders.length > 0
    const canUpload = file && activeProvider && selectedModel && hasApiKeys

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleProviderChange = (provider: string) => {
        setSelectedProvider(provider as LLMProvider)
        setSelectedModel('') // reset model when provider changes
    }

    const handleUpload = async () => {
        if (!canUpload) return

        setUploading(true)
        const formData = new FormData()
        formData.append('target_lang', targetLang)
        formData.append('file', file)
        formData.append('llm_provider', activeProvider)
        formData.append('llm_model', selectedModel)

        try {
            const res = await apiFetch(`/api/upload?target_lang=${encodeURIComponent(targetLang)}`, {
                method: 'POST',
                body: formData,
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Upload failed')
            }

            const data = await res.json()

            if (onSuccess) {
                onSuccess()
                setFile(null)
            } else {
                navigate(`/reader/${data.job_id}`)
            }
        } catch (error: unknown) {
            console.error(error)
            alert(error instanceof Error ? error.message : "Upload failed. Make sure the Gateway is running on port 8080.")
        } finally {
            setUploading(false)
        }
    }

    return (
        <Card className="w-full max-w-md mx-auto rounded-2xl border-slate-200/60 shadow-sm">
            <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>Select a PDF to translate and read.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* File input */}
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>

                {/* Target language */}
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <label htmlFor="language-select" className="text-sm font-medium">Target Language</label>
                    <select
                        id="language-select"
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        <option value="ES">Spanish</option>
                        <option value="ZH">Chinese (Simplified)</option>
                        <option value="FR">French</option>
                        <option value="DE">German</option>
                        <option value="JA">Japanese</option>
                    </select>
                </div>

                {!hasApiKeys ? (
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                        <div className="text-xs text-yellow-800 dark:text-yellow-300">
                            <span className="font-medium">API key required.</span>{' '}
                            Go to{' '}
                            <Link to="/settings" className="font-medium underline">Settings</Link>
                            {' '}to add your API key before uploading.
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Provider selector */}
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <label htmlFor="provider-select" className="text-sm font-medium">Provider</label>
                            <select
                                id="provider-select"
                                value={activeProvider}
                                onChange={(e) => handleProviderChange(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                {configuredProviders.length !== 1 && <option value="">Select a provider</option>}
                                {configuredProviders.map((p) => (
                                    <option key={p} value={p}>{PROVIDER_META[p].label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Model selector */}
                        {activeProvider && (
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <label htmlFor="model-select" className="text-sm font-medium">Model</label>
                                {modelsLoading ? (
                                    <div className="flex items-center gap-2 h-10 px-3 text-sm text-muted-foreground border rounded-md">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Loading models...
                                    </div>
                                ) : modelsError ? (
                                    <div className="text-xs text-red-500 p-2 border border-red-200 rounded-md bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                                        {modelsError}
                                    </div>
                                ) : (
                                    <select
                                        id="model-select"
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        <option value="">Select a model</option>
                                        {models.map((m) => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}
                    </>
                )}

                <Button
                    onClick={handleUpload}
                    disabled={!canUpload || uploading}
                    className="w-full"
                >
                    {uploading ? 'Uploading...' : 'Start Reading'}
                </Button>
            </CardContent>
        </Card>
    )
}
