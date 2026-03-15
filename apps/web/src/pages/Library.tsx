import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import PDFThumbnail from '@/components/PDFThumbnail'
import { useDocumentPolling } from '@/hooks/useDocumentPolling'
import { apiFetch } from '@/lib/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

interface DocumentMeta {
    id: string
    original_name: string
    target_lang: string
    status: string
    llm_provider?: string
    llm_model?: string
    created_at: string
}

export default function LibraryPage() {
    const [documents, setDocuments] = useState<DocumentMeta[]>([])
    const [loading, setLoading] = useState(true)

    const fetchDocuments = useCallback(async () => {
        try {
            const res = await apiFetch('/api/documents')
            if (res.ok) {
                const data = await res.json()
                setDocuments(data || [])
            }
        } catch (error) {
            console.error("Failed to fetch documents", error)
        } finally {
            setLoading(false)
        }
    }, [])

    useDocumentPolling(documents, fetchDocuments)

    const deleteDocument = async (id: string) => {
        if (!confirm("Are you sure you want to permanently delete this document and its translations?")) return
        try {
            const res = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' })
            if (res.ok) {
                fetchDocuments()
            } else {
                alert("Failed to delete document.")
            }
        } catch (error) {
            console.error("Failed to delete document", error)
        }
    }

    useEffect(() => {
        fetchDocuments()
    }, [])

    return (
        <div className="flex min-h-full flex-col py-12 px-6 bg-slate-50/30 text-foreground transition-colors duration-300">
            {/* Header */}
            <div className="w-full max-w-7xl mx-auto mb-12 border-b border-slate-200/50 pb-8">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-800 mb-2">
                    Library
                </h1>
                <p className="text-muted-foreground">
                    All your translated documents in one place.
                </p>
            </div>

            <div className="w-full max-w-7xl mx-auto">
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="bg-muted/50 rounded-2xl aspect-3/4 mb-3 border border-slate-100"></div>
                                <div className="h-4 bg-muted/50 rounded-md w-3/4 mb-2"></div>
                                <div className="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center p-24 border border-dashed border-slate-300 rounded-2xl bg-muted/30">
                        <p className="text-muted-foreground mb-4">Your library is empty.</p>
                        <Link to="/" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                            Upload your first document →
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {documents.map((doc) => (
                            <div key={doc.id} className="group relative flex flex-col">
                                {/* Delete Button */}
                                <button
                                    onClick={() => deleteDocument(doc.id)}
                                    className="absolute top-3 right-3 z-20 p-2 bg-white/90 backdrop-blur-md text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all shadow-md hover:scale-105"
                                    title="Delete Document"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                {/* PDF Thumbnail */}
                                <div className="rounded-2xl overflow-hidden border border-slate-200/60 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group-hover:border-primary/30 mb-4 aspect-3/4 flex items-center justify-center relative">
                                    {doc.status === 'COMPLETED' ? (
                                        <Link to={`/reader/${doc.id}`} className="w-full h-full block">
                                            <PDFThumbnail
                                                url={`${API_URL}/api/documents/${doc.id}/pdf`}
                                            />
                                        </Link>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 p-4 text-center">
                                            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                                            <span className="text-xs text-muted-foreground capitalize">{doc.status.toLowerCase()}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Document Info */}
                                <div className="px-1">
                                    <div className="flex gap-1.5 mb-1.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase ${doc.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            doc.status === 'FAILED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            }`}>
                                            {doc.status}
                                        </span>
                                        {doc.target_lang && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                {doc.target_lang}
                                            </span>
                                        )}
                                        {doc.llm_model && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                                {doc.llm_model}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-medium text-sm line-clamp-2 text-slate-800 group-hover:text-primary transition-colors leading-snug px-1">
                                        {doc.original_name}
                                    </h3>
                                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                                        {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
