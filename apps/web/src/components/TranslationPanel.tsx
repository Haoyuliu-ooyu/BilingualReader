import { useRef, useEffect } from 'react'
import { useReaderStore } from '@/store/useReaderStore'
import { Card, CardContent } from "@/components/ui/card"

export default function TranslationPanel() {
    const { pages, currentPage, setHighlightedBlock, highlightedBlock } = useReaderStore()
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const currentPageData = pages.find(p => p.page_number === currentPage)
    const blocks = currentPageData?.blocks || []

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }, [currentPage])

    return (
        <div ref={scrollContainerRef} className="h-full overflow-y-auto p-4 space-y-4 bg-muted/30 border-l border-border">
            {blocks.length === 0 ? (
                <p className="text-muted-foreground text-center mt-10">No translation data for this page.</p>
            ) : (
                blocks.map((block) => (
                    <Card
                        key={block.id}
                        onClick={() => setHighlightedBlock(block.id)}
                        className={`cursor-pointer transition-all duration-300 border rounded-xl shadow-sm ${highlightedBlock === block.id
                            ? 'bg-primary/5 border-primary/40 shadow-md scale-[1.01]'
                            : 'bg-card border-border hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5'
                            }`}
                    >
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground mb-2 font-serif">{block.original_text}</p>
                            <div className="border-t border-border pt-2">
                                <p className="text-foreground font-medium">{block.translated_text}</p>
                            </div>
                            {block.terms && block.terms.length > 0 && (
                                <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                                    {block.terms.map((t, i) => (
                                        <div key={i}><strong>{t.term}:</strong> {t.definition}</div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    )
}
