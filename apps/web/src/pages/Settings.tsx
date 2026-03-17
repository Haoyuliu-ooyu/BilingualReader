import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys, fetchSavedKeys } from '@/lib/queries'
import { useSaveKey, useRemoveKey } from '@/lib/mutations'
import { PROVIDER_META, type LLMProvider } from '@/store/useSettingsStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Trash2, Plus, Shield, Lock, Database, Loader2, Key } from 'lucide-react'

const ALL_PROVIDERS: LLMProvider[] = ['openai', 'gemini', 'claude']

function SavedKeyRow({ provider, keyHint, onRemove, removing }: { provider: LLMProvider; keyHint: string; onRemove: () => void; removing: boolean }) {
    const meta = PROVIDER_META[provider]

    return (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="w-28 shrink-0">
                <span className="text-sm font-medium">{meta.label}</span>
            </div>
            <div className="flex-1">
                <span className="text-sm text-muted-foreground font-mono">{'*'.repeat(12)}...{keyHint}</span>
            </div>
            <button
                onClick={onRemove}
                disabled={removing}
                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors shrink-0 disabled:opacity-50"
                title="Remove key"
            >
                {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
        </div>
    )
}

function AddKeyRow({ provider, onSave, onCancel }: { provider: LLMProvider; onSave: (key: string) => Promise<void>; onCancel: () => void }) {
    const [key, setKey] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [saving, setSaving] = useState(false)
    const meta = PROVIDER_META[provider]

    const handleSave = async () => {
        if (!key.trim()) return
        setSaving(true)
        try {
            await onSave(key)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save key')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex items-center gap-4 p-4 rounded-xl border bg-card shadow-sm border-primary/30">
            <div className="w-28 shrink-0">
                <span className="text-sm font-medium">{meta.label}</span>
            </div>
            <div className="relative flex-1">
                <input
                    type={showKey ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={meta.placeholder}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    autoFocus
                />
                <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
            </div>
            <Button size="sm" onClick={handleSave} disabled={!key.trim() || saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
            <button
                onClick={onCancel}
                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors shrink-0"
                title="Cancel"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    )
}

function SettingsSkeleton() {
    return (
        <div className="space-y-6">
            {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-10 w-full bg-muted rounded animate-pulse" />
                </div>
            ))}
        </div>
    )
}

export default function Settings() {
    const { data: keysData, isLoading } = useQuery({
        queryKey: queryKeys.llmKeys.list(),
        queryFn: fetchSavedKeys,
    })
    const savedKeys = keysData?.keys || []
    const saveMutation = useSaveKey()
    const removeMutation = useRemoveKey()

    const [addingProvider, setAddingProvider] = useState<LLMProvider | null>(null)

    const savedProviders = savedKeys.map((k) => k.provider)
    const availableToAdd = ALL_PROVIDERS.filter(
        (p) => !savedProviders.includes(p) && p !== addingProvider
    )

    const handleRemove = async (provider: LLMProvider) => {
        try {
            await removeMutation.mutateAsync(provider)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to remove key')
        }
    }

    return (
        <div className="flex min-h-full flex-col items-center py-12 px-6 bg-muted/20 text-foreground transition-colors duration-300">
            <div className="w-full max-w-2xl space-y-8">
                <div className="border-b border-border pb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground mt-1">Manage your API keys for translation providers.</p>
                </div>

                {/* API Keys Card */}
                <Card className="rounded-2xl border-border shadow-sm">
                    <CardHeader>
                        <CardTitle>API Keys</CardTitle>
                        <CardDescription>
                            Add API keys for the providers you want to use. Keys are encrypted and stored
                            securely on the server, so they follow your account across devices.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? (
                            <SettingsSkeleton />
                        ) : savedKeys.length === 0 && !addingProvider ? (
                            <div className="text-center py-8 border border-dashed border-border rounded-xl bg-muted/20">
                                <Key className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                                <p className="text-sm font-medium text-foreground">No API keys saved</p>
                                <p className="text-xs text-muted-foreground mt-1">Add an API key to start translating documents.</p>
                            </div>
                        ) : (
                            <>
                                {savedKeys.map((k) => (
                                    <SavedKeyRow
                                        key={k.provider}
                                        provider={k.provider}
                                        keyHint={k.key_hint}
                                        onRemove={() => handleRemove(k.provider)}
                                        removing={removeMutation.isPending && removeMutation.variables === k.provider}
                                    />
                                ))}
                            </>
                        )}

                        {addingProvider && (
                            <AddKeyRow
                                provider={addingProvider}
                                onSave={async (key) => {
                                    await saveMutation.mutateAsync({ provider: addingProvider, apiKey: key })
                                    setAddingProvider(null)
                                }}
                                onCancel={() => setAddingProvider(null)}
                            />
                        )}

                        {availableToAdd.length > 0 && !addingProvider && !isLoading && (
                            <div className="pt-2 flex gap-2">
                                {availableToAdd.map((p) => (
                                    <Button
                                        key={p}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAddingProvider(p)}
                                        className="gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        {PROVIDER_META[p].label}
                                    </Button>
                                ))}
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground pt-2">
                            Keys are encrypted with AES-256-GCM and stored on the server. You can update or remove them at any time.
                        </p>
                    </CardContent>
                </Card>

                {/* How we handle your key */}
                <Card className="rounded-2xl border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            How we handle your API keys
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                    <Lock className="w-4 h-4 text-green-700 dark:text-green-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Encrypted at rest</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        Your API key is encrypted with AES-256-GCM before being stored.
                                        The plaintext key is never written to the database.
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                    <Database className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Bound to your account</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        Keys are tied to your user account and available across any browser or device
                                        you log into. They are deleted when you remove them or delete your account.
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                    <Trash2 className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Decrypted only when needed</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        The key is decrypted in-memory only when the translation worker
                                        needs to call the AI provider. It is discarded after the job completes.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
