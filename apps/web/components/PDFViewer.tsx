"use client"

import { useEffect, useState, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useReaderStore } from '@/store/useReaderStore'
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';

// Set worker
// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface PDFViewerProps {
    url: string
}

export default function PDFViewer({ url }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0)
    const { currentPage, highlightedBlock, pages } = useReaderStore()
    const [scale, setScale] = useState(1.0)
    const containerRef = useRef<HTMLDivElement>(null)

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages)
    }

    // Find the block data for highlighting
    const currentPageData = pages.find(p => p.page_number === currentPage)
    const activeBlock = currentPageData?.blocks.find(b => b.id === highlightedBlock)

    // Scroll logic could go here or in a wrapper
    useEffect(() => {
        if (activeBlock && containerRef.current) {
            // Simple scroll logic - assumes page 1. For multi-page, activeBlock needs page info.
            // But we are rendering one page at a time for now based on currentPage?
            // Proposal says "Clicking a translated block scrolls the PDF to the bbox coordinates."
            // Let's scroll the highlighted div into view
            const el = document.getElementById(`highlight-${activeBlock.id}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }
    }, [highlightedBlock])

    return (
        <div className="flex flex-col items-center overflow-auto h-full" ref={containerRef}>
            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                className="border shadow-lg"
            >
                <div className="relative">
                    <Page
                        pageNumber={currentPage}
                        scale={scale}
                        onLoadSuccess={(page) => {
                            // Auto-scale logic could go here
                        }}
                    />
                    {/* Overlay Layer for Highlights */}
                    {currentPageData?.blocks.map((block) => {
                        const [x0, y0, x1, y1] = block.bbox
                        // PDF coordinates are (0,0) at bottom-left usually? 
                        // PyMuPDF (0,0) is top-left.
                        // react-pdf also top-left usually.
                        // We need to scale dimensions.
                        // Assuming PDF coordinate system matches.
                        // width = x1 - x0, height = y1 - y0

                        const isHighlighted = block.id === highlightedBlock

                        return (
                            <div
                                key={block.id}
                                id={`highlight-${block.id}`}
                                className={`absolute border-2 transition-all duration-200 ${isHighlighted ? 'border-yellow-500 bg-yellow-500/20' : 'border-transparent hover:border-blue-300'
                                    }`}
                                style={{
                                    left: x0 * scale,
                                    top: y0 * scale,
                                    width: (x1 - x0) * scale,
                                    height: (y1 - y0) * scale,
                                    pointerEvents: 'none' // Let clicks pass through to text layer if needed
                                }}
                            />
                        )
                    })}
                </div>
            </Document>

            <div className="mt-4 flex items-center gap-4">
                <Button
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => useReaderStore.getState().setCurrentPage(currentPage - 1)}
                >
                    Previous
                </Button>
                <span className="text-sm font-medium">Page {currentPage} of {numPages}</span>
                <Button
                    variant="outline"
                    disabled={currentPage >= numPages}
                    onClick={() => useReaderStore.getState().setCurrentPage(currentPage + 1)}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}
