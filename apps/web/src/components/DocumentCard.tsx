import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Cpu } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import PDFThumbnail from '@/components/PDFThumbnail'
import { getErrorMessage } from '@/lib/errorMessages'
import type { DocumentMeta } from '@/lib/queries'
import { motion } from 'framer-motion'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

interface DocumentCardProps {
  document: DocumentMeta
  onDelete: (id: string) => void
  onRetry: (id: string) => void
  showThumbnail?: boolean
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

export function DocumentCard({ document: doc, onDelete, onRetry, showThumbnail = false }: DocumentCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const processing = isProcessing(doc)
  const failed = doc.status === 'FAILED'
  const completed = doc.status === 'COMPLETED'

  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group relative flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow hover:border-primary/30"
    >
      {/* Optional Thumbnail Section */}
      {showThumbnail && (
        <div className="relative w-full h-56 bg-muted/20 border-b border-border overflow-hidden">
          {/* Tags floating on thumbnail */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
            <Badge variant={getStatusVariant(doc.status)} className="shadow-sm backdrop-blur-md bg-background/90">
              {doc.status}
            </Badge>
            {doc.target_lang && (
              <Badge variant="info" className="shadow-sm backdrop-blur-md bg-background/90 text-[10px] px-2">
                {doc.target_lang}
              </Badge>
            )}
          </div>
          
          {doc.status === 'COMPLETED' ? (
            <Link to={`/reader/${doc.id}`} className="w-full h-full block">
              <PDFThumbnail url={`${API_URL}/api/documents/${doc.id}/pdf`} />
            </Link>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
              <span className="text-sm font-medium text-muted-foreground capitalize">{doc.status.toLowerCase()}...</span>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="p-5 flex-1 flex flex-col justify-between relative w-full">


        {/* Tags row (if no thumbnail to host them) */}
        {!showThumbnail && (
          <div className="flex gap-2 items-center mb-3 pr-8 flex-wrap">
            <Badge variant={getStatusVariant(doc.status)}>
              {doc.status}
            </Badge>
            {doc.target_lang && (
              <Badge variant="info">{doc.target_lang}</Badge>
            )}
          </div>
        )}

        {/* Document name */}
        <h3 className="font-semibold text-base line-clamp-2 mb-1 group-hover:text-primary transition-colors pr-2">
          {doc.original_name}
        </h3>

        {/* Metadata info */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
          <span>
            {new Date(doc.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          {doc.llm_model && (
            <div className="flex items-center gap-1 overflow-hidden">
               <span className="w-1 h-1 rounded-full bg-border" />
               <Cpu className="w-3.5 h-3.5 shrink-0" />
               <span className="truncate max-w-[120px]" title={doc.llm_model}>{doc.llm_model}</span>
            </div>
          )}
        </div>

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
          <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-sm text-destructive mb-2">
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
              <p className="mt-2 text-xs text-muted-foreground font-mono break-all p-2 bg-background rounded border">
                {doc.error_detail.message}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-border/50 flex justify-between items-center">
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete(doc.id);
            }}
            className="p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all -ml-1.5"
            aria-label="Delete document"
            title="Delete document"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="flex items-center">
            {completed ? (
              <Link
                to={`/reader/${doc.id}`}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
              >
                Open Reader
              </Link>
            ) : !failed ? (
              <span className="text-sm font-medium text-muted-foreground animate-pulse">Processing...</span>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
