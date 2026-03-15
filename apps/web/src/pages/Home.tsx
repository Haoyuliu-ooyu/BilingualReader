import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import FileUpload from '@/components/FileUpload'
import { Trash2 } from 'lucide-react'
import { useDocumentPolling } from '@/hooks/useDocumentPolling'
import { apiFetch } from '@/lib/api'

interface DocumentMeta {
  id: string
  original_name: string
  target_lang: string
  status: string
  llm_provider?: string
  llm_model?: string
  created_at: string
}

export default function Home() {
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
    if (!confirm("Are you sure you want to permanently delete this document and its translations?")) return;
    try {
      const res = await apiFetch(`/api/documents/${id}`, {
        method: 'DELETE'
      })
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
    <div className="flex min-h-full flex-col items-center py-12 px-6 bg-slate-50/30 text-foreground transition-colors duration-300">

      {/* Minimalist Header */}
      <div className="w-full max-w-5xl mb-12 border-b border-slate-200/50 pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-800 mb-2">
          Bilingual Reader
        </h1>
        <p className="text-muted-foreground">
          Read in another language like a blast with AI.
        </p>
      </div>

      <div className="flex flex-col items-center gap-12 w-full max-w-5xl">

        {/* Upload Section */}
        <div className="w-full bg-card border border-slate-200/60 rounded-2xl p-8 shadow-sm">
          <FileUpload onSuccess={fetchDocuments} />
        </div>

        {/* Document Library Section */}
        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-medium text-slate-700">Recent Documents</h2>
            <Link to="/library" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              View full library →
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-pulse flex space-x-4">
                <div className="rounded-md bg-muted h-20 w-full"></div>
              </div>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center p-16 border border-dashed border-slate-300 rounded-2xl bg-muted/30">
              <p className="text-muted-foreground text-sm">No documents found. Upload a PDF to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.slice(0, 3).map((doc) => (
                <div key={doc.id} className="group relative flex flex-col bg-card border border-slate-200/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 hover:border-primary/20">
                  <div className="p-6 flex-1 flex flex-col relative">

                    {/* Delete overlay button */}
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="absolute top-4 right-4 p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-all z-10"
                      title="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex justify-between items-start mb-3 pr-8">
                      <div className="flex gap-2 items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase ${doc.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          doc.status === 'FAILED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                          {doc.status}
                        </span>
                        {doc.target_lang && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {doc.target_lang}
                          </span>
                        )}
                        {doc.llm_model && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                            {doc.llm_model}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="font-medium text-base line-clamp-2 mb-1 group-hover:text-primary transition-colors pr-2">
                      {doc.original_name}
                    </h3>

                    <span className="text-[11px] text-muted-foreground mb-4">
                      {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-end">
                      {doc.status === 'COMPLETED' ? (
                        <Link
                          to={`/reader/${doc.id}`}
                          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          Open Reader →
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">Processing...</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
