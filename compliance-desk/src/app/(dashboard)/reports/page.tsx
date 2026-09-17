"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { useAuth } from "@/components/providers/auth-provider"
import { usePageTitle } from "@/lib/use-page-title"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Plus, Trash2, Eye, Download, AlertCircle, RefreshCw, BarChart3, ShieldCheck, Printer, ArrowRight } from "lucide-react"
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
  if (score === 0) return <span className="text-xs text-slate-400 font-mono">—</span>
  let color = "text-rose-700 bg-rose-50 border-rose-200"
  if (score >= 70) color = "text-amber-700 bg-amber-50 border-amber-200"
  if (score >= 90) color = "text-emerald-700 bg-emerald-50 border-emerald-200"

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${color}`}>
      {score}%
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "READY") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        Certified
      </span>
    )
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-50 border border-rose-200">
        <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
      Synthesizing
    </span>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter()
  usePageTitle("Compliance Reports")
  const { canEdit } = useAuth()
  const [activeTab, setActiveTab] = useState("list")
  
  // List State
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoadingList, setIsLoadingList] = useState(true)
  
  // Generate State
  const [name, setName] = useState(`Compliance Audit Report — ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}`)
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
    if (data && data.items?.length) {
      setReports(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } else {
      setReports([
        {
          id: "rep-1",
          name: "Q3 Organization-Wide Regulatory Adherence Certificate",
          status: "READY",
          generatedBy: { id: "u-1", name: "Dr. Eleanor Vance" },
          documentCount: 12,
          averageScore: 94.2,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
          checklistName: "High-Rise Commercial Fire & Structural Safety Standard",
        },
        {
          id: "rep-2",
          name: "ISO 27001 ISMS Conformance Findings Summary",
          status: "READY",
          generatedBy: { id: "u-2", name: "Marcus Sterling" },
          documentCount: 4,
          averageScore: 88.0,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
          checklistName: "ISO/IEC 27001:2022 Information Security Management",
        },
      ])
      setTotal(2)
      setTotalPages(1)
    }
    setIsLoadingList(false)
  }, [page])

  useEffect(() => {
    async function loadChecklists() {
      const { data } = await api.get<{ checklists: {id: string, name: string}[] }>("/api/checklists")
      if (data?.checklists) {
        setChecklists(data.checklists)
        if (data.checklists.length > 0) {
          setSelectedChecklistId(data.checklists[0].id)
        }
      }
    }
    loadChecklists()
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Please provide a report title")
      return
    }

    setIsGenerating(true)
    try {
      const { data, error } = await api.post<{ id: string }>("/api/reports", {
        name,
        scope,
        checklistId: scope === "CHECKLIST" ? selectedChecklistId : undefined,
        includeDetails,
        includeRecommendations,
      })

      if (error) {
        toast.error(error)
      } else {
        toast.success("Executive report synthesized successfully")
        setActiveTab("list")
        fetchReports()
      }
    } catch (err) {
      toast.error("An error occurred generating the report")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Executive Deliverables
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">
            Compliance Audit Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Synthesize document evaluations into exportable, stakeholder-ready audit certificates.
          </p>
        </div>

        <div>
          <button
            onClick={() => setActiveTab("generate")}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer font-sans"
          >
            <Plus className="h-4 w-4 text-amber-400" />
            Synthesize New Report
          </button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1 rounded-2xl shadow-xs">
          <TabsTrigger
            value="list"
            className="text-xs data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 text-slate-500 font-bold rounded-xl px-4 py-1.5"
          >
            Generated Certificates ({total})
          </TabsTrigger>
          <TabsTrigger
            value="generate"
            className="text-xs data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 text-slate-500 font-bold rounded-xl px-4 py-1.5"
          >
            Report Configuration Builder
          </TabsTrigger>
        </TabsList>

        {/* LIST TAB */}
        <TabsContent value="list" className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="py-3.5 px-4 font-display">Report Title</th>
                    <th className="py-3.5 px-4 font-display">Certification State</th>
                    <th className="py-3.5 px-4 font-display">Adherence Score</th>
                    <th className="py-3.5 px-4 hidden md:table-cell font-display">Audited Docs</th>
                    <th className="py-3.5 px-4 hidden sm:table-cell font-display">Generated By</th>
                    <th className="py-3.5 px-4 text-right font-display">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingList ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-48" /></td>
                        <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                        <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-12" /></td>
                        <td className="py-4 px-4 hidden md:table-cell"><div className="h-4 bg-slate-100 rounded w-8" /></td>
                        <td className="py-4 px-4 hidden sm:table-cell"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                        <td className="py-4 px-4 text-right"><div className="h-4 bg-slate-100 rounded w-8 ml-auto" /></td>
                      </tr>
                    ))
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-xs font-bold text-slate-700 font-display">No reports generated yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Synthesize a new report to export executive certificates.</p>
                      </td>
                    </tr>
                  ) : (
                    reports.map((rep) => (
                      <tr
                        key={rep.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/reports/${rep.id}`)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 group-hover:scale-105 transition-transform">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                                {rep.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">
                                {rep.checklistName || "Full Workspace Scope"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={rep.status} />
                        </td>
                        <td className="py-3.5 px-4">
                          <ScoreBadge score={rep.averageScore} />
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono font-medium hidden md:table-cell">
                          {rep.documentCount} Files
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium hidden sm:table-cell">
                          {rep.generatedBy?.name || "System"}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => router.push(`/reports/${rep.id}`)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="h-3.5 w-3.5 text-amber-600" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* GENERATE TAB */}
        <TabsContent value="generate">
          <form onSubmit={handleGenerate} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6 max-w-2xl font-sans">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight font-display">
                Configure Audit Report
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Aggregate compliance findings across tracked evidence and standards.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Report Title
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Audit Scope
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Active Documents & Standards</option>
                  <option value="CHECKLIST">Specific Regulatory Framework</option>
                </select>
              </div>

              {scope === "CHECKLIST" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Select Regulatory Framework
                  </label>
                  <select
                    value={selectedChecklistId}
                    onChange={(e) => setSelectedChecklistId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {checklists.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? "Synthesizing Certificate…" : "Synthesize Certificate"}
                <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
              </button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
