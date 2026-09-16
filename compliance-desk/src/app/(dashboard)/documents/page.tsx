"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
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
  filePath: string
  extractedText: string | null
  latestScore: number | null
  createdAt: string
  updatedAt: string
  uploadedBy: { name: string } | null
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "UPLOADED", label: "Uploaded" },
  { value: "PROCESSING", label: "Processing" },
  { value: "MATCHED", label: "Matched" },
  { value: "UNMATCHED", label: "Unmatched" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "COMPLIANT", label: "Compliant" },
  { value: "NON_COMPLIANT", label: "Non-Compliant" },
]

export default function DocumentsPage() {
  const router = useRouter()
  const { isAdmin, canUpload } = useAuth()
  usePageTitle("Documents")

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
      toast.error("Failed to load documents")
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    const { error } = await api.delete(`/api/documents/${deleteTarget.id}`)

    if (error) {
      toast.error(error)
    } else {
      toast.success("Document deleted")
      setDeleteTarget(null)
      fetchDocuments()
    }
    setIsDeleting(false)
  }

  const formatScore = (score: number | null): string => {
    if (score === null || score === undefined) return "-"
    return `${Math.round(score)}%`
  }

  const getScoreColor = (score: number | null): string => {
    if (score === null) return "var(--text-muted)"
    if (score >= 100) return "var(--success)"
    if (score >= 70) return "var(--warning)"
    return "var(--error)"
  }

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Documents"
        description={`${total} document${total !== 1 ? "s" : ""} uploaded`}
        action={
          canUpload
            ? {
                label: "Upload Document",
                icon: Upload,
                onClick: () => setShowUpload(true),
              }
            : undefined
        }
      />

      {/* Filters bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--green-500)"
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--glow-green)"
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)"
              e.currentTarget.style.boxShadow = "none"
            }}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: statusFilter ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        /* Table skeleton */
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Header skeleton */}
          <div
            className="px-5 py-3"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}
          >
            <div className="h-4 w-full grid gap-4" style={{ gridTemplateColumns: "2fr 100px 80px 120px 100px 60px" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 rounded animate-shimmer-green" style={{ animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>
          </div>
          {/* Row skeletons */}
          {Array.from({ length: 8 }).map((_, row) => (
            <div
              key={row}
              className="px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="h-4 w-full grid gap-4" style={{ gridTemplateColumns: "2fr 100px 80px 120px 100px 60px" }}>
                {Array.from({ length: 6 }).map((_, col) => (
                  <div
                    key={col}
                    className="h-4 rounded animate-shimmer-green"
                    style={{ animationDelay: `${(row * 6 + col) * 0.03}s` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div
          className="rounded-xl"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload your first audit or compliance document to begin evaluation."
            action={
              canUpload
                ? {
                    label: "Upload Document",
                    onClick: () => setShowUpload(true),
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* Data table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Table header */}
            <div
              className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{
                gridTemplateColumns: "2fr 110px 80px 130px 100px 50px",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-elevated)",
              }}
            >
              <span>Document</span>
              <span>Status</span>
              <span>Score</span>
              <span>Uploaded By</span>
              <span>Date</span>
              <span></span>
            </div>

            {/* Table rows */}
            {documents.map((doc, index) => (
              <div
                key={doc.id}
                className="grid gap-4 px-5 py-3.5 items-center cursor-pointer transition-colors animate-fade-up"
                style={{
                  gridTemplateColumns: "2fr 110px 80px 130px 100px 50px",
                  borderBottom: "1px solid var(--border)",
                  animationDelay: `${index * 0.03}s`,
                }}
                onClick={() => router.push(`/documents/${doc.id}`)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glow-soft)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Document name + icon */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <FileText className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                  </div>
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {doc.name}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <StatusBadge status={doc.status} />
                </div>

                {/* Score */}
                <span
                  className="text-sm font-semibold font-mono"
                  style={{ color: getScoreColor(doc.latestScore) }}
                >
                  {formatScore(doc.latestScore)}
                </span>

                {/* Uploaded by */}
                <span
                  className="text-sm truncate"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {doc.uploadedBy?.name || "Unknown"}
                </span>

                {/* Date */}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatRelativeTime(doc.createdAt)}
                </span>

                {/* Actions */}
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-7 w-7 rounded-md flex items-center justify-center transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <DropdownMenuItem
                        onClick={() => router.push(`/documents/${doc.id}`)}
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {(doc.status === "COMPLIANT" || doc.status === "NON_COMPLIANT") && (
                        <DropdownMenuItem
                          onClick={() => {
                            window.open(`/api/documents/${doc.id}/results/pdf`, "_blank")
                          }}
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(doc)}
                          style={{ color: "var(--error)" }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Previous
                </button>
                <span className="text-sm px-3" style={{ color: "var(--text-muted)" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Upload modal */}
      <UploadDocumentModal
        open={showUpload}
        onOpenChange={setShowUpload}
        onUploadComplete={fetchDocuments}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Document"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? The file and all compliance results will be permanently removed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  )
}
