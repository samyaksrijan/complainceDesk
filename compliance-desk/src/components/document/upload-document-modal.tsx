"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { toast } from "sonner"
import { Upload, CheckCircle } from "lucide-react"

interface UploadDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: () => void
}

export function UploadDocumentModal({
  open,
  onOpenChange,
  onUploadComplete,
}: UploadDocumentModalProps) {
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState("")

  const resetForm = () => {
    setName("")
    setFile(null)
    setIsUploading(false)
    setUploadSuccess(false)
    setError("")
  }

  const handleClose = (open: boolean) => {
    if (!open && !isUploading) {
      resetForm()
    }
    onOpenChange(open)
  }

  const handleUpload = async () => {
    setError("")

    if (!name.trim()) {
      setError("Document name is required")
      return
    }
    if (name.length > 255) {
      setError("Document name must be 255 characters or less")
      return
    }
    if (!file) {
      setError("Please select a file")
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("name", name.trim())

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type header — browser sets it 
        // automatically with the correct boundary for FormData
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Upload failed")
      }

      setUploadSuccess(true)
      toast.success("Document uploaded successfully")

      // Brief delay to show success state, then close
      setTimeout(() => {
        resetForm()
        onOpenChange(false)
        onUploadComplete()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  // Input styling
  const inputStyle = {
    background: "var(--bg-deep)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-lg"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--text-primary)" }}>
            Upload Document
          </DialogTitle>
          <DialogDescription style={{ color: "var(--text-muted)" }}>
            Upload an audit or compliance document for evaluation.
          </DialogDescription>
        </DialogHeader>

        {uploadSuccess ? (
          /* Success state */
          <div className="flex flex-col items-center py-8 animate-fade-in">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
              style={{
                background: "rgba(34, 197, 94, 0.1)",
                border: "2px solid var(--green-600)",
              }}
            >
              <CheckCircle className="h-8 w-8" style={{ color: "var(--success)" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Document uploaded!
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Text extraction is processing in the background.
            </p>
          </div>
        ) : (
          /* Form state */
          <div className="space-y-5 mt-2">
            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm animate-fade-in"
                style={{
                  background: "rgba(248, 113, 113, 0.1)",
                  border: "1px solid rgba(248, 113, 113, 0.2)",
                  color: "var(--error)",
                }}
              >
                {error}
              </div>
            )}

            {/* Document name */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Document name <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q3 Environmental Audit Report"
                maxLength={255}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--green-500)"
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--glow-green)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.boxShadow = "none"
                }}
                disabled={isUploading}
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {name.length}/255 characters
              </p>
            </div>

            {/* File dropzone */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                File <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <FileDropzone
                file={file}
                onFileSelect={setFile}
                onFileRemove={() => setFile(null)}
                disabled={isUploading}
              />
            </div>

            {/* Upload button */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => handleClose(false)}
                disabled={isUploading}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || !file || !name.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--green-600)", color: "white" }}
                onMouseEnter={(e) => {
                  if (!isUploading && file && name.trim()) {
                    e.currentTarget.style.background = "var(--green-500)"
                    e.currentTarget.style.transform = "translateY(-1px)"
                    e.currentTarget.style.boxShadow = "0 4px 12px var(--glow-green)"
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--green-600)"
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "none"
                }}
              >
                {isUploading ? (
                  <>
                    <div
                      className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                      style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
                    />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
