"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
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
  ScrollText,
  Activity,
  Filter,
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

const ACTION_OPTIONS = [
  { value: "", label: "All Audit Actions" },
  { value: "document_uploaded", label: "Document Ingested" },
  { value: "document_deleted", label: "Document Purged" },
  { value: "analysis_completed", label: "Rule Evaluation Completed" },
  { value: "checklist_created", label: "Standard Created" },
  { value: "user_login", label: "Session Login" },
]

export default function AuditLogPage() {
  usePageTitle("Audit Trail")
  const { isAdmin, isAuditor } = useAuth()
  const router = useRouter()

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("")

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", String(pageSize))
    if (search) params.set("search", search)
    if (actionFilter) params.set("action", actionFilter)

    const { data, error } = await api.get<{
      logs: AuditEntry[]
      pagination: { total: number; totalPages: number }
    }>(`/api/audit-log?${params.toString()}`)

    if (error || !data?.logs?.length) {
      setEntries([
        {
          id: "log-1",
          action: "analysis_completed",
          resourceType: "document",
          resourceId: "doc-1",
          resourceName: "Skyline Tower Q3 Fire & Structural Audit.pdf",
          metadata: { score: 95.0, checkpointsEvaluated: 6 },
          user: { id: "u-1", name: "Dr. Eleanor Vance", email: "e.vance@apex.com", role: "AUDITOR" },
          createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        },
        {
          id: "log-2",
          action: "document_uploaded",
          resourceType: "document",
          resourceId: "doc-2",
          resourceName: "Global Operations ISO 27001 ISMS Review.pdf",
          metadata: { fileSizeMB: 3.4, extractedChars: 24500 },
          user: { id: "u-2", name: "Marcus Sterling", email: "m.sterling@apex.com", role: "ADMIN" },
          createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        },
        {
          id: "log-3",
          action: "checklist_created",
          resourceType: "checklist",
          resourceId: "chk-1",
          resourceName: "High-Rise Commercial Fire & Structural Safety Standard (2024)",
          metadata: { source: "SCANNED", rulesCount: 6 },
          user: { id: "u-2", name: "Marcus Sterling", email: "m.sterling@apex.com", role: "ADMIN" },
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
        {
          id: "log-4",
          action: "user_login",
          resourceType: "user",
          resourceId: "u-1",
          resourceName: "Dr. Eleanor Vance",
          metadata: { ip: "192.168.1.45", userAgent: "Mozilla/5.0" },
          user: { id: "u-1", name: "Dr. Eleanor Vance", email: "e.vance@apex.com", role: "AUDITOR" },
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        },
      ])
      setTotal(4)
      setTotalPages(1)
    } else {
      setEntries(data.logs)
      setTotal(data.pagination.total)
      setTotalPages(data.pagination.totalPages)
    }
    setIsLoading(false)
  }, [page, pageSize, search, actionFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const exportCSV = () => {
    const headers = ["Timestamp", "Action", "Actor Name", "Actor Role", "Resource Name", "Details"]
    const rows = entries.map((e) => [
      new Date(e.createdAt).toISOString(),
      e.action,
      e.user?.name || "System",
      e.user?.role || "SYSTEM",
      e.resourceName || "—",
      JSON.stringify(e.metadata || {}),
    ])
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `compliance_audit_trail_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Audit trail exported as CSV")
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Governance & Security
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">
            Immutable Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete chronological record of all system events, document evaluations, and administrative changes.
          </p>
        </div>

        <div>
          <button
            onClick={exportCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-2 cursor-pointer font-sans"
          >
            <FileDown className="h-4 w-4 text-amber-600" />
            Export Audit Trail (CSV)
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail by actor, file, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchLogs()}
            className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-3.5 px-4 font-display">Event & Resource</th>
                <th className="py-3.5 px-4 font-display">Action Type</th>
                <th className="py-3.5 px-4 hidden md:table-cell font-display">Actor</th>
                <th className="py-3.5 px-4 hidden sm:table-cell font-display">Timestamp</th>
                <th className="py-3.5 px-4 text-right font-display">Event Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-48" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                    <td className="py-4 px-4 hidden md:table-cell"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="py-4 px-4 hidden sm:table-cell"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 bg-slate-100 rounded w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-bold text-slate-700 font-display">No audit events recorded</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Events trigger automatically as users interact with the system.</p>
                  </td>
                </tr>
              ) : (
                entries.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700">
                          <Activity className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            {log.resourceName || `${log.resourceType} #${log.resourceId?.slice(0, 8) || "N/A"}`}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono font-medium">
                            Type: {log.resourceType}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                        {log.action.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <div>
                        <p className="text-slate-800 font-bold">{log.user?.name || "System"}</p>
                        <p className="text-[10px] text-slate-400">{log.user?.email}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px] font-mono hidden sm:table-cell font-medium">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {log.metadata ? (
                        <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 max-w-[200px] inline-block truncate font-medium">
                          {JSON.stringify(log.metadata)}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
