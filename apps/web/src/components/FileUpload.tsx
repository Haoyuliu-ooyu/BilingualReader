import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DropZone } from '@/components/DropZone'
import { useSettingsStore, PROVIDER_META, type LLMProvider } from '@/store/useSettingsStore'
import { useModels } from '@/hooks/useModels'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { queryKeys, fetchSavedKeys } from '@/lib/queries'
import { useUploadDocument } from '@/lib/mutations'

export default function FileUpload() {
    const [file, setFile] = useState<File | null>(null)
    const [targetLang, setTargetLang] = useState('ES')
    const [selectedProvider, setSelectedProvider] = useState<LLMProvider | ''>('')
    const [selectedModel, setSelectedModel] = useState('')
    const [uploadError, setUploadError] = useState<string | null>(null)

    const { data: keysData } = useQuery({
        queryKey: queryKeys.llmKeys.list(),
        queryFn: fetchSavedKeys,
    })
    const configuredProviders = keysData?.keys?.map((k) => k.provider) ?? []

    const uploadMutation = useUploadDocument()

    // Auto-select if only one provider is configured
    const activeProvider = selectedProvider || (configuredProviders.length === 1 ? configuredProviders[0] : '')

    const { models, loading: modelsLoading, error: modelsError } = useModels(
        activeProvider as LLMProvider || null
    )

    const hasApiKeys = configuredProviders.length > 0
    const canUpload = file && activeProvider && selectedModel && hasApiKeys

    const handleProviderChange = (provider: string) => {
        setSelectedProvider(provider as LLMProvider)
        setSelectedModel('') // reset model when provider changes
    }

    const handleUpload = async () => {
        if (!canUpload || !file) return
        setUploadError(null)
        try {
            await uploadMutation.mutateAsync({
                file,
                targetLang,
                llmProvider: activeProvider,
                llmModel: selectedModel,
            })
            setFile(null)
        } catch (error: unknown) {
            console.error(error)
            setUploadError(error instanceof Error ? error.message : 'Upload failed. Make sure the Gateway is running on port 8080.')
        }
    }

    return (
        <Card className="w-full max-w-md mx-auto rounded-2xl border-border shadow-sm">
            <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>Select a PDF to translate and read.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Drop zone */}
                <DropZone onFileSelect={(f) => setFile(f)} accept=".pdf" />
                {file && (
                    <p className="text-sm text-muted-foreground truncate">
                        Selected: {file.name}
                    </p>
                )}

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

                {uploadError && (
                    <p className="text-sm text-red-500">{uploadError}</p>
                )}

                <Button
                    onClick={handleUpload}
                    disabled={!canUpload || uploadMutation.isPending}
                    className="w-full"
                >
                    {uploadMutation.isPending ? 'Uploading...' : 'Start Reading'}
                </Button>
            </CardContent>
        </Card>
    )
}
