import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { queryKeys, fetchDocumentTree, fetchDocumentPDF } from '@/lib/queries'
import { useReaderStore } from '@/store/useReaderStore'
import TranslationPanel from '@/components/TranslationPanel'
import PDFViewer from '@/components/PDFViewer'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ReaderPage() {
    const { id } = useParams()
    const setJobId = useReaderStore(state => state.setJobId)
    const setPages = useReaderStore(state => state.setPages)
    const [bannerDismissed, setBannerDismissed] = useState(false)

    const { data: pages, isLoading: treeLoading, isError: treeError, refetch: refetchTree } = useQuery({
        queryKey: queryKeys.documents.tree(id!),
        queryFn: () => fetchDocumentTree(id!),
        enabled: !!id,
    })

    const { data: pdfUrl } = useQuery({
        queryKey: queryKeys.documents.pdf(id!),
        queryFn: () => fetchDocumentPDF(id!),
        enabled: !!id,
        staleTime: Infinity,
        gcTime: 0,
    })

    // Sync job ID to reader store
    useEffect(() => {
        if (id) setJobId(id)
    }, [id, setJobId])

    // Sync pages to reader store for TranslationPanel
    useEffect(() => {
        if (pages) setPages(pages)
    }, [pages, setPages])

    // Partial results detection
    const blockedCount = pages?.reduce((acc, page) =>
        acc + page.blocks.filter(b => b.original_text && !b.translated_text).length, 0
    ) ?? 0
    const totalBlocks = pages?.reduce((acc, page) => acc + page.blocks.length, 0) ?? 0
    const hasPartialResults = blockedCount > 0 && blockedCount < totalBlocks

    // Loading skeleton
    if (treeLoading) {
        return (
            <div className="h-full flex flex-col md:flex-row">
                <div className="w-full md:w-1/2 bg-muted animate-pulse" />
                <div className="w-full md:w-1/2 h-1/2 md:h-full p-6 space-y-4">
                    <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                    <div className="h-4 bg-muted rounded w-full animate-pulse" />
                    <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
                </div>
            </div>
        )
    }

    // Error state
    if (treeError) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                    <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
                    <p className="text-muted-foreground">Failed to load document.</p>
                    <Button variant="outline" onClick={() => refetchTree()}>
                        Retry
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            {/* Partial results banner */}
            {hasPartialResults && !bannerDismissed && (
                <div className="bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-800 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-yellow-800 dark:text-yellow-300">
                        {blockedCount} segments were blocked by content filters. Available translations are shown below.
                    </span>
                    <button onClick={() => setBannerDismissed(true)} aria-label="Dismiss">
                        <X className="h-4 w-4 text-yellow-800 dark:text-yellow-300" />
                    </button>
                </div>
            )}

            <div className="flex-1 flex flex-col md:flex-row min-h-0">
                {/* Left: PDF Viewer (50% width) */}
                <div className="w-full md:w-1/2 bg-muted/30 border-r border-border overflow-hidden relative">
                    {pdfUrl && <PDFViewer url={pdfUrl} />}
                </div>

                {/* Right: Translation Panel (50% width) */}
                <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-hidden">
                    <TranslationPanel />
                </div>
            </div>
        </div>
    )
}
