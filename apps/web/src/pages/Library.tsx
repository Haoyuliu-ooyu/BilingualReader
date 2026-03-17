import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Library } from 'lucide-react'
import PDFThumbnail from '@/components/PDFThumbnail'
import { DocumentCard } from '@/components/DocumentCard'
import { Skeleton } from '@/components/ui/skeleton'
import { queryKeys, fetchDocuments, shouldPollDocuments } from '@/lib/queries'
import { useDeleteDocument, useRetryDocument } from '@/lib/mutations'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export default function LibraryPage() {
  const { data: documents = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.documents.list(),
    queryFn: fetchDocuments,
    refetchInterval: (query) => shouldPollDocuments(query.state.data),
  })

  const deleteMutation = useDeleteDocument()
  const retryMutation = useRetryDocument()

  return (
    <div className="flex min-h-full flex-col py-12 px-6 bg-background text-foreground transition-colors duration-300">
      {/* Header */}
      <div className="w-full max-w-7xl mx-auto mb-12 border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2">
          Library
        </h1>
        <p className="text-muted-foreground">
          All your translated documents in one place.
        </p>
      </div>

      <div className="w-full max-w-7xl mx-auto">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i}>
                <Skeleton className="rounded-2xl aspect-3/4 mb-3" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center p-24 border border-dashed border-border rounded-2xl bg-muted/30">
            <p className="text-muted-foreground">
              Couldn't load documents.{' '}
              <button onClick={() => refetch()} className="text-primary font-medium hover:underline">
                Retry
              </button>
            </p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center p-24 border border-dashed border-border rounded-2xl bg-muted/30">
            <Library className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold text-foreground mb-1">Your library is empty</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Upload a PDF from the Home page to get started.
            </p>
            <Link to="/" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              Go to Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {documents.map((doc) => (
              <div key={doc.id} className="group relative flex flex-col">
                {/* PDF Thumbnail */}
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group-hover:border-primary/30 mb-4 aspect-3/4 flex items-center justify-center relative">
                  {doc.status === 'COMPLETED' ? (
                    <Link to={`/reader/${doc.id}`} className="w-full h-full block">
                      <PDFThumbnail url={`${API_URL}/api/documents/${doc.id}/pdf`} />
                    </Link>
                  ) : (
                    <div className="flex flex-col items-center gap-2 p-4 text-center">
                      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                      <span className="text-sm text-muted-foreground capitalize">{doc.status.toLowerCase()}</span>
                    </div>
                  )}
                </div>

                {/* Document Info via DocumentCard-style layout */}
                <DocumentCard
                  document={doc}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onRetry={(id) => retryMutation.mutate(id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
