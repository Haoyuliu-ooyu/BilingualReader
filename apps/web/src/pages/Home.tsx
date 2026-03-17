import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import FileUpload from '@/components/FileUpload'
import { DocumentCard } from '@/components/DocumentCard'
import { Skeleton } from '@/components/ui/skeleton'
import { queryKeys, fetchDocuments, shouldPollDocuments } from '@/lib/queries'
import { useDeleteDocument, useRetryDocument } from '@/lib/mutations'

export default function Home() {
  const { data: documents = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.documents.list(),
    queryFn: fetchDocuments,
    refetchInterval: (query) => shouldPollDocuments(query.state.data),
  })

  const deleteMutation = useDeleteDocument()
  const retryMutation = useRetryDocument()

  return (
    <div className="flex min-h-full flex-col items-center py-12 px-6 bg-background text-foreground transition-colors duration-300">

      {/* Minimalist Header */}
      <div className="w-full max-w-5xl mb-12 border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2">
          Bilingual Reader
        </h1>
        <p className="text-muted-foreground">
          Read in another language like a blast with AI.
        </p>
      </div>

      <div className="flex flex-col items-center gap-12 w-full max-w-5xl">

        {/* Upload Section */}
        <div className="w-full bg-card border border-border rounded-2xl p-8 shadow-sm">
          <FileUpload />
        </div>

        {/* Document Library Section */}
        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-foreground">Recent Documents</h2>
            <Link to="/library" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              View full library
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-6">
                  <Skeleton className="h-4 w-24 mb-3" />
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center p-16 border border-dashed border-border rounded-2xl bg-muted/30">
              <p className="text-muted-foreground text-sm">
                Couldn't load documents.{' '}
                <button onClick={() => refetch()} className="text-primary font-medium hover:underline">
                  Retry
                </button>
              </p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center p-16 border border-dashed border-border rounded-2xl bg-muted/30">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-1">No documents yet</h3>
              <p className="text-muted-foreground text-sm">Upload a PDF above to start translating.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.slice(0, 3).map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onRetry={(id) => retryMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
