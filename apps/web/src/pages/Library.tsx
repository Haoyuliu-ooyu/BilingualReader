import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Library } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DocumentCard } from '@/components/DocumentCard'
import { Skeleton } from '@/components/ui/skeleton'
import { queryKeys, fetchDocuments, shouldPollDocuments } from '@/lib/queries'
import { useDeleteDocument, useRetryDocument } from '@/lib/mutations'

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
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            <AnimatePresence mode="popLayout">
              {documents.map((doc) => (
                <motion.div 
                  layout
                  key={doc.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                >
                  <DocumentCard
                    document={doc}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onRetry={(id) => retryMutation.mutate(id)}
                    showThumbnail={true}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  )
}
