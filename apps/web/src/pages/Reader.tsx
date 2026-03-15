import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useReaderStore, Page } from '@/store/useReaderStore'
import TranslationPanel from '@/components/TranslationPanel'
import PDFViewer from '@/components/PDFViewer'
import { apiFetch } from '@/lib/api'

export default function ReaderPage() {
    const { id } = useParams()
    const setJobId = useReaderStore(state => state.setJobId)
    const setPages = useReaderStore(state => state.setPages)
    const [loading, setLoading] = useState(true)
    const [pdfData, setPdfData] = useState<string | null>(null)

    useEffect(() => {
        if (id) {
            setJobId(id)

            // Fetch document tree data
            apiFetch(`/api/documents/${id}`)
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch document data')
                    return res.json()
                })
                .then((data: Page[]) => {
                    setPages(data)
                    setLoading(false)
                })
                .catch(err => {
                    console.error(err)
                    setLoading(false)
                })

            // Fetch PDF as blob with auth headers
            apiFetch(`/api/documents/${id}/pdf`)
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch PDF')
                    return res.blob()
                })
                .then(blob => {
                    setPdfData(URL.createObjectURL(blob))
                })
                .catch(err => console.error('PDF fetch error:', err))
        }

        return () => {
            if (pdfData) URL.revokeObjectURL(pdfData)
        }
    }, [id, setJobId, setPages])

    if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>

    return (
        <div className="h-full flex flex-col md:flex-row">
            {/* Left: PDF Viewer (50% width) */}
            <div className="w-full md:w-1/2 bg-slate-50/50 border-r border-slate-200/50 overflow-hidden relative">
                {pdfData && <PDFViewer url={pdfData} />}
            </div>

            {/* Right: Translation Panel (50% width) */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-hidden">
                <TranslationPanel />
            </div>
        </div>
    )
}
