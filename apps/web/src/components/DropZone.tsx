import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'

interface DropZoneProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number
}

export function DropZone({ onFileSelect, accept = '.pdf', maxSize }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const validateAndSelect = (file: File | undefined) => {
    if (!file) return
    // Validate file type
    if (accept && !file.name.toLowerCase().endsWith(accept.replace('*', ''))) return
    // Validate file size
    if (maxSize && file.size > maxSize) return
    onFileSelect(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    validateAndSelect(file)
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    validateAndSelect(file)
    // Reset input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center min-h-[160px] rounded-2xl cursor-pointer transition-colors duration-200 ${
        isDragOver
          ? 'border-2 border-dashed border-primary bg-primary/5'
          : 'border-2 border-dashed border-muted-foreground/25 bg-muted/30'
      }`}
    >
      <Upload
        className={`w-10 h-10 mb-3 ${
          isDragOver ? 'text-primary' : 'text-muted-foreground'
        }`}
      />
      <p className="text-sm text-muted-foreground text-center px-4">
        {isDragOver ? 'Drop your PDF here' : 'Drag and drop a PDF here, or click to browse'}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  )
}
