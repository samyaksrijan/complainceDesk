"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { ArrowRight, CheckCircle2, Upload } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface UploadDocumentModalProps {
  open: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  onUploadComplete?: () => void
}

export function UploadDocumentModal({
  open,
  onClose,
  onOpenChange,
  onSuccess,
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

  const handleCloseDialog = (isOpen: boolean) => {
    if (!isOpen && !isUploading) {
      resetForm()
      if (onClose) onClose()
      if (onOpenChange) onOpenChange(false)
    }
  }

  const handleUpload = async () => {
    setError("")

    if (!name.trim()) {
      setError("Document title is required")
      return
    }
    if (!file) {
      setError("Please select an audit document file")
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
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Upload failed")
      }

      const uploaded = await res.json()
      setUploadSuccess(true)
      if (uploaded.extractionError) toast.warning("File saved, but extraction failed. Open the document for details.")
      else toast.success("Audit document ingested and text extracted")

      setTimeout(() => {
        resetForm()
        if (onClose) onClose()
        if (onOpenChange) onOpenChange(false)
        if (onSuccess) onSuccess()
        if (onUploadComplete) onUploadComplete()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-md bg-white border border-slate-200 text-slate-900 p-6 rounded-2xl shadow-xl font-sans">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
              <Upload className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight font-display">
              Ingest Audit Documentation
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            Upload inspection reports, audit certificates, or policy files for automated rule verification.
          </DialogDescription>
        </DialogHeader>

        {uploadSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 font-display">Ingestion Complete</h4>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Text indexed and ready for standard matching.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Document Display Title
              </label>
              <input
                type="text"
                placeholder="e.g. Skyline Tower Q3 Fire Safety Inspection"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Audit File Attachment
              </label>
              <FileDropzone
                file={file}
                onFileRemove={() => setFile(null)}
                onFileSelect={(f) => {
                  setFile(f)
                  if (!name && f?.name) {
                    setName(f.name.replace(/\.[^/.]+$/, ""))
                  }
                }}
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleCloseDialog(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? "Extracting & Ingesting…" : "Ingest Document"}
                <ArrowRight className="h-3.5 w-3.5 text-brand-400" />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
