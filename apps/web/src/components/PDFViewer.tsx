import { useEffect, useState, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useReaderStore } from '@/store/useReaderStore'
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';

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

    const currentPageData = pages.find(p => p.page_number === currentPage)
    const activeBlock = currentPageData?.blocks.find(b => b.id === highlightedBlock)

    useEffect(() => {
        if (activeBlock && containerRef.current) {
            const el = document.getElementById(`highlight-${activeBlock.id}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }
    }, [highlightedBlock])

    const handlePageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value)
        if (!isNaN(val) && val >= 1 && val <= numPages) {
            useReaderStore.getState().setCurrentPage(val)
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Sticky Navigation Header */}
            <div className="flex items-center justify-between p-3 bg-white border-b shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => useReaderStore.getState().setCurrentPage(currentPage - 1)}
                    >
                        Previous
                    </Button>
                    <div className="flex items-center gap-2 mx-2">
                        <span className="text-sm font-medium">Page</span>
                        <input
                            type="number"
                            min={1}
                            max={numPages || 1}
                            value={currentPage}
                            onChange={handlePageChange}
                            className="w-16 h-8 text-center border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                        <span className="text-sm font-medium text-gray-500">of {numPages}</span>
                    </div>
                </div>
                <div className="flex items-center">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= numPages || numPages === 0}
                        onClick={() => useReaderStore.getState().setCurrentPage(currentPage + 1)}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Scrollable PDF Container */}
            <div className="flex-1 overflow-auto flex justify-center p-4" ref={containerRef}>
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="border shadow-lg bg-white"
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
                                        pointerEvents: 'none'
                                    }}
                                />
                            )
                        })}
                    </div>
                </Document>
            </div>
        </div>
    )
}
