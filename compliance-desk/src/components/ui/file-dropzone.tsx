"use client"

import { useState, useRef, useCallback } from "react"
import { Upload, File, X, AlertCircle } from "lucide-react"

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  file: File | null
  accept?: string
  maxSizeMB?: number
  disabled?: boolean
}

const ACCEPTED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "text/plain": [".txt"],
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".txt"]

export function FileDropzone({
  onFileSelect,
  onFileRemove,
  file,
  maxSizeMB = 10,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    (f: File): string | null => {
      // Check extension
      const ext = "." + f.name.split(".").pop()?.toLowerCase()
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return `File type "${ext}" is not supported. Accepted: PDF, DOCX, PNG, JPG, TXT`
      }

      // Check size
      const sizeMB = f.size / (1024 * 1024)
      if (sizeMB > maxSizeMB) {
        return `File is ${sizeMB.toFixed(1)}MB. Maximum size is ${maxSizeMB}MB.`
      }

      return null
    },
    [maxSizeMB]
  )

  const handleFile = useCallback(
    (f: File) => {
      setError("")
      const validationError = validateFile(f)
      if (validationError) {
        setError(validationError)
        return
      }
      onFileSelect(f)
    },
    [validateFile, onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (disabled) return

      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [disabled, handleFile]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    // Reset input so the same file can be re-selected
    e.target.value = ""
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase()
    if (ext === "pdf") return "📄"
    if (ext === "docx") return "📝"
    if (ext === "txt") return "📃"
    if (ext === "png" || ext === "jpg" || ext === "jpeg") return "🖼"
    return "📎"
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {file ? (
        /* File selected state */
        <div
          className="flex items-center gap-4 p-4 rounded-xl"
          style={{
            background: "var(--bg-deep)",
            border: "1px solid var(--green-700)",
          }}
        >
          <span className="text-2xl">{getFileIcon(file.name)}</span>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {file.name}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatFileSize(file.size)}
            </p>
          </div>
          {!disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFileRemove()
              }}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        /* Dropzone state */
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative flex flex-col items-center justify-center p-8
            rounded-xl cursor-pointer transition-all duration-200
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
          style={{
            background: isDragOver ? "var(--glow-soft)" : "var(--bg-deep)",
            border: `2px dashed ${
              isDragOver ? "var(--green-500)" : "var(--border)"
            }`,
            boxShadow: isDragOver ? "0 0 20px var(--glow-green)" : "none",
          }}
        >
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
            style={{
              background: isDragOver ? "var(--green-900)" : "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
          >
            <Upload
              className="h-6 w-6"
              style={{
                color: isDragOver ? "var(--green-400)" : "var(--text-muted)",
              }}
            />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            {isDragOver
              ? "Drop file here"
              : "Drag and drop a file, or click to browse"}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            PDF, DOCX, PNG, JPG, TXT — Max {maxSizeMB}MB
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs animate-fade-in"
          style={{
            background: "rgba(248, 113, 113, 0.1)",
            color: "var(--error)",
          }}
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
