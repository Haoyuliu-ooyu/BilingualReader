import { useState, useEffect } from 'react'
import { useSettingsStore, PROVIDER_META, type LLMProvider } from '@/store/useSettingsStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Trash2, Plus, Shield, Lock, Database, Loader2 } from 'lucide-react'

const ALL_PROVIDERS: LLMProvider[] = ['openai', 'gemini', 'claude']

function SavedKeyRow({ provider, keyHint, onRemove }: { provider: LLMProvider; keyHint: string; onRemove: () => void }) {
    const meta = PROVIDER_META[provider]

    return (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200/60 bg-card shadow-sm">
            <div className="w-28 shrink-0">
                <span className="text-sm font-medium">{meta.label}</span>
            </div>
            <div className="flex-1">
                <span className="text-sm text-muted-foreground font-mono">{'*'.repeat(12)}...{keyHint}</span>
            </div>
            <button
                onClick={onRemove}
                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors shrink-0"
                title="Remove key"
            >
                <Trash2 className="w-4 h-4" />
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

export default function Settings() {
    const { savedKeys, fetchSavedKeys, saveKey, removeKey } = useSettingsStore()
    const [addingProvider, setAddingProvider] = useState<LLMProvider | null>(null)
    const [removing, setRemoving] = useState<string | null>(null)

    useEffect(() => {
        fetchSavedKeys()
    }, [fetchSavedKeys])

    const savedProviders = savedKeys.map((k) => k.provider)
    const availableToAdd = ALL_PROVIDERS.filter(
        (p) => !savedProviders.includes(p) && p !== addingProvider
    )

    const handleRemove = async (provider: LLMProvider) => {
        setRemoving(provider)
        try {
            await removeKey(provider)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to remove key')
        } finally {
            setRemoving(null)
        }
    }

    return (
        <div className="flex min-h-full flex-col items-center py-12 px-6 bg-slate-50/30 text-foreground transition-colors duration-300">
            <div className="w-full max-w-2xl space-y-8">
                <div className="border-b pb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground mt-1">Manage your API keys for translation providers.</p>
                </div>

                {/* API Keys Card */}
                <Card className="rounded-2xl border-slate-200/60 shadow-sm">
                    <CardHeader>
                        <CardTitle>API Keys</CardTitle>
                        <CardDescription>
                            Add API keys for the providers you want to use. Keys are encrypted and stored
                            securely on the server, so they follow your account across devices.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {savedKeys.length === 0 && !addingProvider && (
                            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-slate-300 rounded-xl bg-muted/20">
                                No API keys configured. Add one to get started.
                            </div>
                        )}

                        {savedKeys.map((k) => (
                            <SavedKeyRow
                                key={k.provider}
                                provider={k.provider}
                                keyHint={k.key_hint}
                                onRemove={() => handleRemove(k.provider)}
                            />
                        ))}
                        {removing && (
                            <div className="text-xs text-muted-foreground">Removing...</div>
                        )}

                        {addingProvider && (
                            <AddKeyRow
                                provider={addingProvider}
                                onSave={async (key) => {
                                    await saveKey(addingProvider, key)
                                    setAddingProvider(null)
                                }}
                                onCancel={() => setAddingProvider(null)}
                            />
                        )}

                        {availableToAdd.length > 0 && !addingProvider && (
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
                <Card className="rounded-2xl border-slate-200/60 shadow-sm">
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
