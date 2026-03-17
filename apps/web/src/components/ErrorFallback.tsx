import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorFallbackProps {
  error: Error | null
  onReset: () => void
}

export function ErrorFallback({ onReset }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
      <AlertTriangle className="w-12 h-12 text-muted-foreground" />
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        An unexpected error occurred on this page.
      </p>
      <Button onClick={() => window.location.reload()}>
        Reload Page
      </Button>
    </div>
  )
}
