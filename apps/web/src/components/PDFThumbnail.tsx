import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { FileText } from 'lucide-react'
import { apiFetch } from '@/lib/api'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString()

export interface PDFThumbnailProps {
    url: string
}

export default function PDFThumbnail({ url }: PDFThumbnailProps) {
    const [loadError, setLoadError] = useState(false)
    const [blobUrl, setBlobUrl] = useState<string | null>(null)

    useEffect(() => {
        // Fetch PDF via apiFetch so auth headers are attached
        apiFetch(new URL(url).pathname)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch PDF')
                return res.blob()
            })
            .then(blob => setBlobUrl(URL.createObjectURL(blob)))
            .catch(() => setLoadError(true))

        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl)
        }
    }, [url])

    if (loadError || !blobUrl) {
        if (loadError) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <FileText className="w-8 h-8 opacity-40" />
                    <span className="text-[10px]">Preview unavailable</span>
                </div>
            )
        }
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
        )
    }

    return (
        <div className="w-full h-full overflow-hidden flex items-center justify-center bg-white dark:bg-slate-900">
            <Document
                file={blobUrl}
                onLoadError={() => setLoadError(true)}
                loading={
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                }
            >
                <Page
                    pageNumber={1}
                    width={220}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    className="pointer-events-none select-none"
                />
            </Document>
        </div>
    )
}
