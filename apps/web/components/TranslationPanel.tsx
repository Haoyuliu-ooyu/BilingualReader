"use client"

import { useReaderStore } from '@/store/useReaderStore'
import { Card, CardContent } from "@/components/ui/card" // Assuming Card component exists or I'll implement it

// Minimal Card implementation if not exists, but I'll assume I can just use div for now to save tokens/files
// actually I should make it nice.

export default function TranslationPanel() {
    const { pages, currentPage, setHighlightedBlock, highlightedBlock } = useReaderStore()

    const currentPageData = pages.find(p => p.page_number === currentPage)
    const blocks = currentPageData?.blocks || []

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 bg-slate-50 border-l">
            {blocks.length === 0 ? (
                <p className="text-gray-500 text-center mt-10">No translation data for this page.</p>
            ) : (
                blocks.map((block) => (
                    <Card
                        key={block.id}
                        onClick={() => setHighlightedBlock(block.id)}
                        className={`cursor-pointer transition-colors border ${highlightedBlock === block.id
                            ? 'bg-blue-50 border-blue-500 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-blue-300'
                            }`}
                    >
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-500 mb-2 font-serif">{block.original_text}</p>
                            <div className="border-t pt-2">
                                <p className="text-gray-900 font-medium">{block.translated_text}</p>
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
