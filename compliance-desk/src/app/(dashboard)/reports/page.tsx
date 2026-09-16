"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { useAuth } from "@/components/providers/auth-provider"
import { usePageTitle } from "@/lib/use-page-title"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Plus, Trash2, Eye, Download, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { formatRelativeTime } from "@/components/notifications/notification-bell"

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface ReportSummary {
  id: string
  name: string
  status: "GENERATING" | "READY" | "FAILED"
  generatedBy: { id: string; name: string }
  documentCount: number
  averageScore: number
  createdAt: string
  completedAt: string | null
  checklistName: string | null
}

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  if (score === 0) return <span className="text-xs text-text-muted">—</span>
  let color = "text-red-400 bg-red-900/30 border-red-900/50"
  if (score >= 70) color = "text-amber-400 bg-amber-900/30 border-amber-900/50"
  if (score === 100) color = "text-green-400 bg-green-900/30 border-green-900/50"

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {score}%
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "READY") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-900/30 border border-green-900/50">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Ready
      </span>
    )
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-900/30 border border-red-900/50">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-900/30 border border-amber-900/50">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      Generating
    </span>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter()
  usePageTitle("Reports")
  const { canEdit } = useAuth()
  const [activeTab, setActiveTab] = useState("list")
  
  // List State
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoadingList, setIsLoadingList] = useState(true)
  
  // Generate State
  const [name, setName] = useState(`Compliance Report — ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}`)
  const [scope, setScope] = useState<"ALL" | "CHECKLIST" | "CUSTOM">("ALL")
  const [selectedChecklistId, setSelectedChecklistId] = useState("")
  const [checklists, setChecklists] = useState<{id: string, name: string}[]>([])
  const [includeDetails, setIncludeDetails] = useState(true)
  const [includeRecommendations, setIncludeRecommendations] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  // Fetch List
  const fetchReports = useCallback(async () => {
    setIsLoadingList(true)
    const { data } = await api.get<{ items: ReportSummary[], total: number, totalPages: number }>(`/api/reports?page=${page}&limit=20`)
    if (data) {
      setReports(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    }
    setIsLoadingList(false)
  }, [page])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  // Polling for GENERATING reports
  useEffect(() => {
    const generatingReports = reports.filter(r => r.status === "GENERATING")
    if (generatingReports.length === 0) return

    const interval = setInterval(async () => {
      const { data } = await api.get<{ items: ReportSummary[] }>(`/api/reports?page=${page}&limit=20`)
      if (data) {
        setReports(data.items)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [reports, page])

  // Fetch Checklists for scope selection
  useEffect(() => {
    if (scope === "CHECKLIST" && checklists.length === 0) {
      api.get("/api/checklists").then(({ data }) => {
        if (data?.items) {
          setChecklists(data.items)
          if (data.items.length > 0) setSelectedChecklistId(data.items[0].id)
        }
      })
    }
  }, [scope, checklists.length])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this report?")) return
    const { error } = await api.delete(`/api/reports/${id}`)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Report deleted")
      fetchReports()
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (scope === "CHECKLIST" && !selectedChecklistId) {
      toast.error("Please select a checklist")
      return
    }

    setIsGenerating(true)
    const payload = {
      name,
      checklistId: scope === "CHECKLIST" ? selectedChecklistId : undefined,
      includeDetails,
      includeRecommendations,
    }

    const { data, error } = await api.post("/api/reports/generate", payload)
    setIsGenerating(false)

    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success("Report generation started")
      setPage(1)
      setActiveTab("list")
      fetchReports()
      // Reset form
      setName(`Compliance Report — ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}`)
      setScope("ALL")
    }
  }

  return (
    <div className="animate-fade-up pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Compliance Reports
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Generate and export organizational compliance summaries
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-surface border-border">
            <TabsTrigger value="list" className="data-[state=active]:bg-elevated data-[state=active]:text-green-400">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            {canEdit && (
              <TabsTrigger value="generate" className="data-[state=active]:bg-elevated data-[state=active]:text-green-400">
                <Plus className="h-4 w-4 mr-2" />
                Generate
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* LIST TAB */}
        <TabsContent value="list" className="outline-none">
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-elevated/50 text-text-muted">
                    <th className="px-6 py-4 font-medium w-1/3">Report Name</th>
                    <th className="px-6 py-4 font-medium w-32">Status</th>
                    <th className="px-6 py-4 font-medium w-24">Documents</th>
                    <th className="px-6 py-4 font-medium w-24">Avg Score</th>
                    <th className="px-6 py-4 font-medium w-40">Generated By</th>
                    <th className="px-6 py-4 font-medium w-32">Created</th>
                    <th className="px-6 py-4 font-medium w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingList ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><div className="h-4 w-3/4 bg-border/50 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-16 bg-border/50 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-8 bg-border/50 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-10 bg-border/50 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-24 bg-border/50 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-20 bg-border/50 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-12 bg-border/50 rounded animate-pulse ml-auto" /></td>
                      </tr>
                    ))
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <FileText className="h-10 w-10 mx-auto mb-3 opacity-20 text-text-muted" />
                        <h3 className="text-base font-semibold text-text-primary mb-1">No reports generated yet</h3>
                        <p className="text-sm text-text-muted mb-4">Create your first compliance report to get started.</p>
                        {canEdit && (
                          <button
                            onClick={() => setActiveTab("generate")}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                          >
                            <Plus className="h-4 w-4" />
                            Generate Report
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    reports.map((report) => (
                      <tr 
                        key={report.id} 
                        className={`group transition-colors ${report.status === "READY" ? "cursor-pointer hover:bg-elevated" : ""}`}
                        onClick={() => report.status === "READY" && router.push(`/reports/${report.id}`)}
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-text-primary">{report.name}</p>
                          {report.checklistName && (
                            <p className="text-xs text-text-muted mt-0.5">Filter: {report.checklistName}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={report.status} />
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {report.status === "GENERATING" ? "—" : report.documentCount}
                        </td>
                        <td className="px-6 py-4">
                          {report.status === "GENERATING" ? <span className="text-text-muted">—</span> : <ScoreBadge score={report.averageScore} />}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {report.generatedBy.name}
                        </td>
                        <td className="px-6 py-4 text-text-secondary text-xs">
                          {formatRelativeTime(report.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {report.status === "READY" && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); router.push(`/reports/${report.id}`) }}
                                  className="p-1.5 text-text-muted hover:text-green-400 hover:bg-green-400/10 rounded transition-colors"
                                  title="View Report"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/reports/${report.id}?print=true`)
                                  }}
                                  className="p-1.5 text-text-muted hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                                  title="Download PDF / Print"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {canEdit && (
                              <button
                                onClick={(e) => handleDelete(report.id, e)}
                                className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                title="Delete"
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
            
            {/* Pagination */}
            {!isLoadingList && totalPages > 1 && (
              <div className="border-t border-border px-6 py-4 flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} reports
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-border rounded hover:bg-elevated disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border border-border rounded hover:bg-elevated disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* GENERATE TAB */}
        {canEdit && (
          <TabsContent value="generate" className="outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form Config */}
              <div className="lg:col-span-2 space-y-6">
                <form id="generate-form" onSubmit={handleGenerate} className="bg-surface border border-border rounded-xl p-6 space-y-6">
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">1. Report Configuration</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text-secondary">Report Name</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-deep border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium text-text-secondary">Scope Selection</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scope === "ALL" ? "bg-green-900/10 border-green-500" : "bg-deep border-border hover:border-text-muted"}`}>
                          <input type="radio" name="scope" value="ALL" checked={scope === "ALL"} onChange={() => setScope("ALL")} className="mt-1 accent-green-500" />
                          <div>
                            <p className="text-sm font-medium text-text-primary">All Documents</p>
                            <p className="text-xs text-text-muted mt-0.5">Include all analyzed documents</p>
                          </div>
                        </label>
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scope === "CHECKLIST" ? "bg-green-900/10 border-green-500" : "bg-deep border-border hover:border-text-muted"}`}>
                          <input type="radio" name="scope" value="CHECKLIST" checked={scope === "CHECKLIST"} onChange={() => setScope("CHECKLIST")} className="mt-1 accent-green-500" />
                          <div>
                            <p className="text-sm font-medium text-text-primary">By Checklist</p>
                            <p className="text-xs text-text-muted mt-0.5">Filter to a specific checklist</p>
                          </div>
                        </label>
                      </div>

                      {scope === "CHECKLIST" && (
                        <div className="pt-2 animate-in slide-in-from-top-2">
                          <label className="text-xs font-medium text-text-muted mb-1 block">Select Checklist</label>
                          <select
                            value={selectedChecklistId}
                            onChange={e => setSelectedChecklistId(e.target.value)}
                            className="w-full bg-deep border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-green-500 outline-none"
                            required={scope === "CHECKLIST"}
                          >
                            <option value="" disabled>Select a checklist...</option>
                            {checklists.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">2. Report Options</h3>
                    
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={includeDetails} 
                        onChange={e => {
                          setIncludeDetails(e.target.checked)
                          if (!e.target.checked) setIncludeRecommendations(false)
                        }} 
                        className="mt-1 accent-green-500 w-4 h-4" 
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary">Include Detailed Findings</p>
                        <p className="text-xs text-text-muted mt-0.5">Include clause-level breakdowns for every document</p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 ${!includeDetails ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input 
                        type="checkbox" 
                        checked={includeRecommendations} 
                        onChange={e => setIncludeRecommendations(e.target.checked)} 
                        disabled={!includeDetails}
                        className="mt-1 accent-green-500 w-4 h-4" 
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary">Include Recommendations</p>
                        <p className="text-xs text-text-muted mt-0.5">Include LLM-generated recommendations for failed items</p>
                      </div>
                    </label>
                  </div>

                </form>
              </div>

              {/* Preview Sidebar */}
              <div className="space-y-6">
                <div className="bg-elevated border border-border rounded-xl p-5 sticky top-24">
                  <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-green-400" />
                    Preview Summary
                  </h3>
                  
                  <div className="space-y-4 text-sm">
                    <p className="text-text-secondary">
                      This report will analyze documents filtered by: 
                      <span className="font-semibold text-text-primary ml-1">
                        {scope === "ALL" ? "All Sources" : checklists.find(c => c.id === selectedChecklistId)?.name || "Selected Checklist"}
                      </span>
                    </p>
                    
                    <div className="bg-surface rounded-lg p-3 border border-border">
                      <div className="flex items-start gap-2 mb-2 text-text-muted">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p className="text-xs">Exact document counts and scores will be computed during generation.</p>
                      </div>
                      <ul className="text-xs space-y-1.5 text-text-secondary list-disc pl-4">
                        <li>Detailed findings: {includeDetails ? <span className="text-green-400">Yes</span> : <span className="text-text-muted">No</span>}</li>
                        <li>Recommendations: {includeRecommendations ? <span className="text-green-400">Yes</span> : <span className="text-text-muted">No</span>}</li>
                      </ul>
                    </div>

                    <button
                      form="generate-form"
                      type="submit"
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all font-medium disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          Generate Report
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
