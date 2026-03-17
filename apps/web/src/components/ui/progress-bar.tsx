import { motion } from 'framer-motion'

interface ProgressBarProps {
  phase: string | null | undefined
  translatedCount: number
  totalCount: number
  status?: string
}

const PHASE_LABELS: Record<string, string> = {
  extracting: 'Extracting...',
  generating_context: 'Generating Context...',
  translating: '', // handled separately with counts
}

export function ProgressBar({ phase, translatedCount, totalCount, status }: ProgressBarProps) {
  const isTranslating = phase === 'translating'
  const percentage = isTranslating && totalCount > 0
    ? Math.round((translatedCount / totalCount) * 100)
    : 0

  // Determine label
  let label = ''
  if (status === 'INTERRUPTED') {
    label = 'Resuming...'
  } else if (isTranslating) {
    label = `${translatedCount}/${totalCount} segments \u2014 ${percentage}%`
  } else if (phase && PHASE_LABELS[phase] !== undefined) {
    label = PHASE_LABELS[phase]
  } else {
    label = 'Queued...'
  }

  return (
    <div className="w-full space-y-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        {isTranslating ? (
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
        ) : (
          <div className="h-full bg-primary/50 rounded-full animate-pulse w-full" />
        )}
      </div>
    </div>
  )
}
