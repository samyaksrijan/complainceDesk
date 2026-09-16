"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { usePageTitle } from "@/lib/use-page-title"
import { api } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"
import { toast } from "sonner"
import {
  Upload,
  Shield,
  Trash2,
  Download,
  RefreshCw,
  List,
  LogIn,
  LogOut,
  UserPlus,
  Settings2,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  FileDown,
  AlertTriangle,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  resourceName: string | null
  metadata: Record<string, any> | null
  user: { id: string; name: string; email: string; role: string } | null
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All actions" },
  { value: "document_uploaded", label: "Document Uploaded" },
  { value: "document_deleted", label: "Document Deleted" },
  { value: "document_downloaded", label: "Document Downloaded" },
  { value: "analysis_completed", label: "Analysis Completed" },
  { value: "analysis_failed", label: "Analysis Failed" },
  { value: "reanalysis_triggered", label: "Re-analysis Triggered" },
  { value: "checklist_created", label: "Checklist Created" },
  { value: "checklist_updated", label: "Checklist Updated" },
  { value: "checklist_deleted", label: "Checklist Deleted" },
  { value: "user_login", label: "User Login" },
  { value: "user_logout", label: "User Logout" },
  { value: "user_created", label: "User Created" },
  { value: "user_role_changed", label: "Role Changed" },
]

const PAGE_SIZE_OPTIONS = [25, 50, 100]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActionIcon(action: string) {
  const a = action.toLowerCase()
  const cls = "h-3.5 w-3.5"
  if (a.includes("upload")) return <Upload className={cls} />
  if (a.includes("delete")) return <Trash2 className={cls} />
  if (a.includes("download")) return <Download className={cls} />
  if (a.includes("analysis") || a.includes("scan")) return <Shield className={cls} />
  if (a.includes("reanalysis")) return <RefreshCw className={cls} />
  if (a.includes("checklist")) return <List className={cls} />
  if (a.includes("login")) return <LogIn className={cls} />
  if (a.includes("logout")) return <LogOut className={cls} />
  if (a.includes("user_created")) return <UserPlus className={cls} />
  if (a.includes("role")) return <Settings2 className={cls} />
  return <Shield className={cls} />
}

function getActionColor(action: string): string {
  const a = action.toLowerCase()
  if (a.includes("delete") || a.includes("failed")) return "var(--error)"
  if (a.includes("upload") || a.includes("created")) return "var(--success)"
  if (a.includes("analysis") || a.includes("download")) return "var(--green-400)"
  if (a.includes("login") || a.includes("logout")) return "#94a3b8"
  if (a.includes("role") || a.includes("reanalysis")) return "var(--warning)"
  return "var(--text-muted)"
}

function humanizeAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

function formatRelativeTime(dateStr: string): string {
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      className="grid gap-4 px-5 py-4 items-center"
      style={{
        gridTemplateColumns: "120px 1fr 140px 2fr 160px 100px 40px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-4 rounded animate-shimmer-green"
          style={{ animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  )
}

// ─── Expanded Row ─────────────────────────────────────────────────────────────

function ExpandedRow({ entry }: { entry: AuditEntry }) {
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0
  return (
    <div
      className="px-5 pb-5 pt-2 animate-fade-in"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-deep)" }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Full Description
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {entry.action} on {entry.resourceType}
            {entry.resourceName ? ` — ${entry.resourceName}` : ""}
          </p>
        </div>

        {hasMetadata && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Metadata
            </p>
            <dl className="space-y-1">
              {Object.entries(entry.metadata!).map(([key, val]) => (
                <div key={key} className="flex items-start gap-3 text-xs">
                  <dt className="font-mono flex-shrink-0 px-1.5 py-0.5 rounded" style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {key}
                  </dt>
                  <dd style={{ color: "var(--text-secondary)" }}>{String(val)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {!hasMetadata && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Metadata
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>No additional metadata</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const router = useRouter()
  const pathname = usePathname()
  usePageTitle("Audit Log")
  const searchParams = useSearchParams()
  const { isAdmin, isAuditor, isViewer } = useAuth()

  // Filters from URL
  const [action, setAction] = useState(searchParams.get("action") || "")
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "")
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "")
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1") || 1)
  const [limit, setLimit] = useState(parseInt(searchParams.get("limit") || "25") || 25)

  const [searchInput, setSearchInput] = useState(search)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  // Sync URL params when filters change
  const syncUrl = useCallback((overrides: Record<string, string | number>) => {
    const params = new URLSearchParams()
    const merged = { action, search, startDate, endDate, page: String(page), limit: String(limit), ...overrides }
    Object.entries(merged).forEach(([k, v]) => {
      if (v && String(v) !== "1" || k === "page") {
        if (String(v)) params.set(k, String(v))
      }
    })
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [action, search, startDate, endDate, page, limit, pathname, router])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchEntries = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)

    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", String(limit))
    if (action) params.set("action", action)
    if (search) params.set("search", search)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)

    const { data, error } = await api.get(`/api/audit-log?${params.toString()}`)
    if (error) {
      setIsError(true)
    } else if (data) {
      setEntries(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    }
    setIsLoading(false)
  }, [page, limit, action, search, startDate, endDate])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const clearFilters = () => {
    setAction("")
    setSearchInput("")
    setSearch("")
    setStartDate("")
    setEndDate("")
    setPage(1)
    router.replace(pathname, { scroll: false })
  }

  const hasFilters = !!(action || search || startDate || endDate)

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExport = async () => {
    if (total === 0) {
      toast.error("No results to export")
      return
    }
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      if (action) params.set("action", action)
      if (search) params.set("search", search)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      params.set("limit", "10000")

      // Build CSV from current data (since we may not have a real export endpoint)
      const { data, error } = await api.get(`/api/audit-log?${params.toString()}`)
      if (error || !data?.items) throw new Error("Export failed")

      const headers = ["Timestamp", "User", "Role", "Action", "Resource Type", "Resource Name", "Metadata"]
      const rows = (data.items as AuditEntry[]).map((e) => [
        new Date(e.createdAt).toISOString(),
        e.user?.name || "Unknown",
        e.user?.role || "",
        e.action,
        e.resourceType,
        e.resourceName || "",
        e.metadata ? JSON.stringify(e.metadata) : "",
      ])

      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n")

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Exported successfully")
    } catch {
      toast.error("Export failed. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  // ── Access denied ──────────────────────────────────────────────────────────
  if (isViewer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in max-w-md mx-auto">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: "rgba(248, 113, 113, 0.1)", border: "1px solid rgba(248, 113, 113, 0.2)" }}
        >
          <AlertTriangle className="h-8 w-8" style={{ color: "var(--error)" }} />
        </div>
        <h1 className="text-2xl font-display font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Access Denied
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          You do not have permission to view the audit log. Contact your administrator if you believe this is a mistake.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  const paginationPages = () => {
    const pages: (number | "...")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push("...")
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
      if (page < totalPages - 2) pages.push("...")
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="animate-fade-up pb-12">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Audit Log
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Complete record of all system activity — {total.toLocaleString()} entr{total === 1 ? "y" : "ies"}
        </p>
      </div>

      {/* ── Sticky filter bar ──────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 rounded-xl px-5 py-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search actions, users, resources…"
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all duration-200"
            style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--green-500)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--glow-green)" }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
          />
        </div>

        {/* Action filter */}
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: action ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
            style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: startDate ? "var(--text-primary)" : "var(--text-muted)" }}
          />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
            style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: endDate ? "var(--text-primary)" : "var(--text-muted)" }}
          />
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--error)"; e.currentTarget.style.borderColor = "var(--error)" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)" }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Page size */}
          <select
            value={limit}
            onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1) }}
            className="px-2 py-2 rounded-lg text-xs outline-none cursor-pointer"
            style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExport}
            disabled={isExporting || total === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--green-700)", color: "white", border: "1px solid var(--green-600)" }}
            onMouseEnter={(e) => { if (!isExporting && total > 0) { e.currentTarget.style.background = "var(--green-600)"; e.currentTarget.style.boxShadow = "0 2px 8px var(--glow-green)" } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--green-700)"; e.currentTarget.style.boxShadow = "none" }}
          >
            {isExporting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {isError && (
        <div
          className="mb-4 rounded-lg px-4 py-3 flex items-center gap-3 text-sm"
          style={{ background: "rgba(248, 113, 113, 0.08)", border: "1px solid rgba(248, 113, 113, 0.2)", color: "var(--error)" }}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Failed to load audit log entries.
          <button
            onClick={fetchEntries}
            className="ml-auto text-xs underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Data table ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        {/* Table header */}
        <div
          className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
          style={{
            gridTemplateColumns: "130px 160px 160px 1fr 160px 110px 36px",
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          <span>Timestamp</span>
          <span>User</span>
          <span>Action</span>
          <span>Description</span>
          <span>Target</span>
          <span>IP Address</span>
          <span />
        </div>

        {/* Loading */}
        {isLoading && (
          <>{[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}</>
        )}

        {/* Empty state */}
        {!isLoading && !isError && entries.length === 0 && (
          <div className="py-16 flex flex-col items-center text-center">
            <Shield className="h-10 w-10 mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              {hasFilters ? "No activity found matching your filters" : "No activity recorded yet"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {hasFilters
                ? "Try adjusting your search terms or date range."
                : "Actions will appear here as users interact with the system."}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Rows */}
        {!isLoading && entries.map((entry, idx) => {
          const isExpanded = expandedRows.has(entry.id)
          const isEvenRow = idx % 2 === 0
          const actionColor = getActionColor(entry.action)
          const isDocument = entry.resourceType === "document"
          const isChecklist = entry.resourceType === "checklist"

          return (
            <div key={entry.id}>
              {/* Main row */}
              <div
                className="grid gap-4 px-5 py-3.5 items-center transition-colors cursor-pointer"
                style={{
                  gridTemplateColumns: "130px 160px 160px 1fr 160px 110px 36px",
                  borderBottom: "1px solid var(--border)",
                  background: isEvenRow ? "transparent" : "rgba(255,255,255,0.01)",
                }}
                onClick={() => toggleRow(entry.id)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glow-soft)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = isEvenRow ? "transparent" : "rgba(255,255,255,0.01)")}
              >
                {/* Timestamp */}
                <span
                  className="text-xs font-mono"
                  style={{ color: "var(--text-muted)" }}
                  title={formatFullDate(entry.createdAt)}
                >
                  {formatRelativeTime(entry.createdAt)}
                </span>

                {/* User */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                    {entry.user?.name || "System"}
                  </span>
                  {entry.user?.role && <StatusBadge status={entry.user.role} size="sm" />}
                </div>

                {/* Action */}
                <div className="flex items-center gap-2">
                  <span style={{ color: actionColor }}>{getActionIcon(entry.action)}</span>
                  <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                    {humanizeAction(entry.action)}
                  </span>
                </div>

                {/* Description */}
                <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {entry.action} on {entry.resourceType}
                  {entry.resourceName ? ` — ${entry.resourceName}` : ""}
                </span>

                {/* Target */}
                <div className="flex items-center gap-2 min-w-0">
                  {entry.resourceType && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: "var(--bg-deep)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono, monospace)" }}
                    >
                      {entry.resourceType}
                    </span>
                  )}
                  {entry.resourceName && (isDocument || isChecklist) ? (
                    <button
                      className="text-xs truncate hover:underline"
                      style={{ color: "var(--green-400)" }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isDocument) router.push(`/documents/${entry.resourceId}`)
                        else if (isChecklist) router.push(`/checklists/${entry.resourceId}`)
                      }}
                    >
                      {entry.resourceName}
                    </button>
                  ) : (
                    <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {entry.resourceName || "—"}
                    </span>
                  )}
                </div>

                {/* IP address — not in current schema, show N/A */}
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  —
                </span>

                {/* Expand chevron */}
                <div className="flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRight className="h-4 w-4" />
                  }
                </div>
              </div>

              {/* Expanded metadata row */}
              {isExpanded && <ExpandedRow entry={entry} />}
            </div>
          )
        })}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()} entries
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Previous
            </button>
            {paginationPages().map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className="h-8 w-8 rounded-lg text-sm transition-colors font-medium"
                  style={{
                    background: page === p ? "var(--green-600)" : "transparent",
                    color: page === p ? "white" : "var(--text-secondary)",
                    border: page === p ? "none" : "1px solid var(--border)",
                  }}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
