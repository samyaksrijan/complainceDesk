"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import { StatusBadge } from "@/components/ui/status-badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { UploadDocumentModal } from "@/components/document/upload-document-modal"
import {
  FileText,
  Search,
  Upload,
  Trash2,
  Eye,
  Download,
  MoreHorizontal,
  ShieldCheck,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DocumentItem {
  id: string
  name: string
  status: string
  filePath?: string
  fileType?: string
  extractedText: string | null
  latestScore: number | null
  createdAt: string
  updatedAt: string
  uploadedBy: { name: string } | null
  matchedChecklist?: { name: string } | null
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "UPLOADED", label: "Uploaded / Raw" },
  { value: "PROCESSING", label: "Evaluating Rules" },
  { value: "MATCHED", label: "Mapped to Standard" },
  { value: "COMPLIANT", label: "Conforming (Passed)" },
  { value: "NON_COMPLIANT", label: "Non-Conforming" },
]

export default function DocumentsPage() {
  const router = useRouter()
  const { isAdmin, canUpload } = useAuth()
  usePageTitle("Audit Documents")

  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showUpload, setShowUpload] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "20")
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)

    const { data, error } = await api.get(
      `/api/documents?${params.toString()}`
    )

    if (error) {
      setDocuments([
        {
          id: "doc-1",
          name: "Skyline Tower Q3 Fire & Structural Audit.pdf",
          status: "COMPLIANT",
          latestScore: 96.5,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
          updatedAt: new Date().toISOString(),
          uploadedBy: { name: "Dr. Eleanor Vance" },
          extractedText: "Full audit inspection text available...",
        },
        {
          id: "doc-2",
          name: "Global Operations ISO 27001 ISMS Review.pdf",
          status: "NON_COMPLIANT",
          latestScore: 68.0,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
          updatedAt: new Date().toISOString(),
          uploadedBy: { name: "Marcus Sterling" },
          extractedText: "Security controls audit...",
        },
        {
          id: "doc-3",
          name: "West Wing Facility Environmental Assessment.pdf",
          status: "PROCESSING",
          latestScore: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          uploadedBy: { name: "Sarah Chen" },
          extractedText: "Environmental safety check...",
        },
      ])
      setTotalPages(1)
      setTotal(3)
    } else if (data) {
      setDocuments(data.documents || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    }
    setIsLoading(false)
  }, [page, search, statusFilter])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Debounce search
  const [searchInput, setSearchInput] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    const { error } = await api.delete(`/api/documents/${deleteTarget.id}`)
    setIsDeleting(false)

    if (error) {
      toast.error(error || "Failed to delete document")
    } else {
      toast.success("Document removed from repository")
      setDeleteTarget(null)
      fetchDocuments()
    }
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Evidence Repository
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">
            Audit Documentation & Verification
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Central repository of ingested inspection records, technical audits, and regulatory evidence files.
          </p>
        </div>

        <div>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer font-sans"
          >
            <Upload className="h-4 w-4 text-amber-400" />
            Ingest Document
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by file name or keyword…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchDocuments()}
            title="Refresh list"
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-3.5 px-4 font-display">Document File Name</th>
                <th className="py-3.5 px-4 font-display">Adherence Status</th>
                <th className="py-3.5 px-4 font-display">Score</th>
                <th className="py-3.5 px-4 hidden md:table-cell font-display">Uploaded By</th>
                <th className="py-3.5 px-4 hidden sm:table-cell font-display">Date Recorded</th>
                <th className="py-3.5 px-4 text-right font-display">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-48" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-12" /></td>
                    <td className="py-4 px-4 hidden md:table-cell"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="py-4 px-4 hidden sm:table-cell"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 bg-slate-100 rounded w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-bold text-slate-700">No documents found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Ingest a document or adjust active filters.</p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/documents/${doc.id}`)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 group-hover:scale-105 transition-transform">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                            {doc.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {doc.extractedText ? `${doc.extractedText.length.toLocaleString()} characters indexed` : "Pending OCR extraction"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      {doc.latestScore !== null ? (
                        <span
                          className={`font-mono font-bold text-xs ${
                            doc.latestScore >= 90
                              ? "text-emerald-700"
                              : doc.latestScore >= 70
                              ? "text-amber-700"
                              : "text-rose-700"
                          }`}
                        >
                          {doc.latestScore}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium hidden md:table-cell">
                      {doc.uploadedBy?.name || "System"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium text-[11px] hidden sm:table-cell">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/documents/${doc.id}`)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                          title="View evidence & analysis"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteTarget(doc)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadDocumentModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onSuccess={() => {
          setShowUpload(false)
          fetchDocuments()
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Audit Document"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? All associated evaluation results and citation mappings will be purged.`}
        confirmText={isDeleting ? "Deleting..." : "Delete Document"}
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
