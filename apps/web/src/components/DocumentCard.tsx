import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { getErrorMessage } from '@/lib/errorMessages'
import type { DocumentMeta } from '@/lib/queries'

interface DocumentCardProps {
  document: DocumentMeta
  onDelete: (id: string) => void
  onRetry: (id: string) => void
}

const STATUS_BADGE_VARIANT = {
  COMPLETED: 'success',
  FAILED: 'error',
} as const

function getStatusVariant(status: string) {
  return STATUS_BADGE_VARIANT[status as keyof typeof STATUS_BADGE_VARIANT] ?? 'warning'
}

function isProcessing(doc: DocumentMeta) {
  return (
    doc.status === 'PENDING' ||
    doc.status === 'INTERRUPTED' ||
    (doc.pipeline_phase && doc.status !== 'COMPLETED' && doc.status !== 'FAILED')
  )
}

export function DocumentCard({ document: doc, onDelete, onRetry }: DocumentCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const processing = isProcessing(doc)
  const failed = doc.status === 'FAILED'
  const completed = doc.status === 'COMPLETED'

  return (
    <div className="group relative flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 hover:border-primary/20">
      <div className="p-6 flex-1 flex flex-col relative">
        {/* Delete button */}
        <button
          onClick={() => onDelete(doc.id)}
          className="absolute top-4 right-4 p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-all z-10"
          aria-label="Delete document"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Badge row */}
        <div className="flex gap-2 items-center mb-3 pr-8">
          <Badge variant={getStatusVariant(doc.status)}>
            {doc.status}
          </Badge>
          {doc.target_lang && (
            <Badge variant="info">{doc.target_lang}</Badge>
          )}
          {doc.llm_model && (
            <Badge variant="accent">{doc.llm_model}</Badge>
          )}
        </div>

        {/* Document name */}
        <h3 className="font-semibold text-base line-clamp-2 mb-1 group-hover:text-primary transition-colors pr-2">
          {doc.original_name}
        </h3>

        {/* Date */}
        <span className="text-sm text-muted-foreground mb-4">
          {new Date(doc.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>

        {/* Progress bar (if processing) */}
        {processing && (
          <div className="mb-4">
            <ProgressBar
              phase={doc.pipeline_phase ?? null}
              translatedCount={doc.translated_count}
              totalCount={doc.total_count}
              status={doc.status}
            />
          </div>
        )}

        {/* Error banner (if failed) */}
        {failed && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400 mb-2">
              {getErrorMessage(doc.error_detail)}
            </p>
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={() => onRetry(doc.id)}>
                Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDetails((v) => !v)}>
                Details
              </Button>
            </div>
            {showDetails && doc.error_detail?.message && (
              <p className="mt-2 text-sm text-muted-foreground font-mono break-all">
                {doc.error_detail.message}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-border flex justify-end">
          {completed ? (
            <Link
              to={`/reader/${doc.id}`}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Open Reader
            </Link>
          ) : !failed ? (
            <span className="text-sm font-medium text-muted-foreground">Processing...</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
