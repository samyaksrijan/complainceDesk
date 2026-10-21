"use client"

import { PaginationControls } from "@/components/ui/pagination-controls"

import { useAuth } from "@/components/providers/auth-provider"
import { csvCell } from "@/lib/csv"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import {
    Activity,
    FileDown,
    Filter,
    RefreshCw,
    ScrollText,
    Search
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  resourceName: string | null
  metadata: Record<string, unknown> | null
  user: { id: string; name: string; email: string; role: string } | null
  createdAt: string
}

const ACTION_OPTIONS = [
  { value: "", label: "All Audit Actions" },
  { value: "document.uploaded", label: "Document Ingested" },
  { value: "document.deleted", label: "Document Purged" },
  { value: "document.checked", label: "Rule Evaluation Completed" },
  { value: "checklist.created", label: "Standard Created" },
  { value: "user.login", label: "Session Login" },
]

export default function AuditLogPage() {
  usePageTitle("Audit Trail")
  const { isAdmin, isAuditor } = useAuth()


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

    if (error) toast.error(error)
    setEntries(data?.logs || [])
    setTotal(data?.pagination.total || 0)
    setTotalPages(Math.max(1, data?.pagination.totalPages || 1))
    setIsLoading(false)
  }, [page, pageSize, search, actionFilter])

  useEffect(() => {
    void Promise.resolve().then(fetchLogs)
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
    const csvContent = [headers.map(csvCell).join(","), ...rows.map(row => row.map(csvCell).join(","))].join("\r\n")
    const encodedUri = URL.createObjectURL(new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `compliance_audit_trail_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(encodedUri)
    toast.success("Current audit page exported as CSV")
  }

  if (!isAdmin && !isAuditor) return <p className="p-6">You do not have access to the audit trail.</p>

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
              Governance & Security
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">
            Organization Audit Trail
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
            <FileDown className="h-4 w-4 text-brand-600" />
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
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
            className="w-full sm:w-auto px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
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
                        <div className="p-2 rounded-xl bg-brand-50 border border-brand-200/80 text-brand-700">
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
                        <span className="text-[10px] font-mono text-brand-800 bg-brand-50 px-2 py-1 rounded-lg border border-brand-200 max-w-[200px] inline-block truncate font-medium">
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
      <label className="text-xs">Rows per page <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="ml-2 rounded border p-2"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
      <PaginationControls page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  )
}
