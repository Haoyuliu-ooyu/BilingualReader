"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useReaderStore, Page } from '@/store/useReaderStore'
import TranslationPanel from '@/components/TranslationPanel'

// Dynamically import PDFViewer with no SSR to avoid canvas issues
const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false })

export default function ReaderPage() {
    const { id } = useParams()
    const setJobId = useReaderStore(state => state.setJobId)
    const setPages = useReaderStore(state => state.setPages)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (id) {
            setJobId(id as string)

            // Mock Fetch Data
            // In real app: fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${id}`)

            // Simulating data received from Gateway -> Redis -> Worker -> DB
            const mockPages: Page[] = [
                {
                    page_number: 1,
                    blocks: [
                        {
                            id: "b1",
                            original_text: "The mitochondria is the powerhouse of the cell.",
                            translated_text: "线粒体是细胞的动力源。",
                            bbox: [50, 50, 300, 100], // Example coordinates
                            terms: [{ term: "mitochondria", definition: "Cell organelle" }]
                        },
                        {
                            id: "b2",
                            original_text: "It generates most of the chemical energy needed to power the cell's biochemical reactions.",
                            translated_text: "它产生细胞生化反应所需的大部分化学能。",
                            bbox: [50, 120, 500, 180]
                        }
                    ]
                }
            ]

            setTimeout(() => {
                setPages(mockPages)
                setLoading(false)
            }, 1000)
        }
    }, [id, setJobId, setPages])

    if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>

    return (
        <div className="h-screen flex flex-col md:flex-row">
            {/* Left: PDF Viewer (60% width) */}
            <div className="flex-1 bg-gray-100 p-4 border-r overflow-hidden relative">
                {/* We need a PDF file. Use a sample one for testing. */}
                {/* Since we don't have Gateway to serve the file, let's use a public sample or placeholder */}
                {/* In production: `http://localhost:8080/api/files/${id}` */}
                <PDFViewer url="https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf" />
            </div>

            {/* Right: Translation Panel (40% width) */}
            <div className="w-full md:w-1/3 min-w-[300px] h-1/2 md:h-full overflow-hidden">
                <TranslationPanel />
            </div>
        </div>
    )
}
