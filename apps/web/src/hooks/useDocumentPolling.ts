import { useEffect, useRef } from 'react'

const FINAL_STATES = new Set(['COMPLETED', 'FAILED'])
const POLL_INTERVAL_MS = 10000

/**
 * Polls `fetchFn` every POLL_INTERVAL_MS milliseconds as long as
 * `documents` contains any document NOT in a final state.
 * Automatically stops when all documents reach a terminal state.
 */
export function useDocumentPolling(
    documents: Array<{ status: string }>,
    fetchFn: () => Promise<void>
) {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const hasPending = documents.some(d => !FINAL_STATES.has(d.status))

    useEffect(() => {
        if (hasPending) {
            // Start polling
            timerRef.current = setInterval(() => {
                fetchFn()
            }, POLL_INTERVAL_MS)
        }

        return () => {
            if (timerRef.current !== null) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }, [hasPending, fetchFn])
}
