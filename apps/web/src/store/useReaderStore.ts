import { create } from 'zustand'

export interface Block {
    id: string
    original_text: string
    translated_text: string
    bbox: number[] // [x0, y0, x1, y1]
    terms?: { term: string; definition: string }[]
}

export interface Page {
    page_number: number
    blocks: Block[]
}

interface ReaderState {
    jobId: string | null
    pages: Page[]
    currentPage: number
    highlightedBlock: string | null

    setJobId: (id: string) => void
    setPages: (pages: Page[]) => void
    setCurrentPage: (page: number) => void
    setHighlightedBlock: (blockId: string | null) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
    jobId: null,
    pages: [],
    currentPage: 1,
    highlightedBlock: null,

    setJobId: (id) => set({ jobId: id }),
    setPages: (pages) => set({ pages }),
    setCurrentPage: (page) => set({ currentPage: page }),
    setHighlightedBlock: (blockId) => set({ highlightedBlock: blockId }),
}))
