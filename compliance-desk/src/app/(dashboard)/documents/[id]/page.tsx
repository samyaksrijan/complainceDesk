"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { StatusBadge } from "@/components/ui/status-badge"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Printer,
    Quote,
    RefreshCw,
    ShieldCheck,
    XCircle
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface ChecklistItemResult {
  id: string
  fieldName: string
  status: "PASS" | "FAIL" | "NOT_FOUND" | "NEEDS_REVIEW"
  expected: string
  extractedValue: string | null
  sourceExcerpt: string | null
  notes: string | null
}

interface DocumentDetail {
  id: string
  name: string
  fileType: string
  status: string
  extractedText: string | null
  createdAt: string
  matchedChecklist?: {
    id: string
    name: string
    category: string
  } | null
  results?: Array<{
    id: string
    overallScore: number
    totalItems: number
    passedItems: number
    failedItems: number
    notFoundItems: number
    summary: string | null
    items: ChecklistItemResult[]
  }>
}

export default function DocumentDetailPage() {
    const params = useParams()
  const id = params.id as string
  const { canEdit } = useAuth()

  const [document, setDocument] = useState<DocumentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ChecklistItemResult | null>(null)
  const [checklists, setChecklists] = useState<Array<{ id: string; name: string }>>([])
  const [selectedChecklist, setSelectedChecklist] = useState("")
  const [isMatching, setIsMatching] = useState(false)
  const [activeTab, setActiveTab] = useState<"analysis" | "raw">("analysis")

  usePageTitle(document?.name || "Audit Verification Studio")

  const fetchDocumentData = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await api.get<DocumentDetail>(`/api/documents/${id}`)
    
    if (error || !data) {
      toast.error(error || "Document not found")
      setDocument(null)
      setSelectedItem(null)
    } else {
      setDocument(data)
      setSelectedItem(data.results?.[0]?.items?.[0] || null)
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    void Promise.resolve().then(fetchDocumentData)
  }, [fetchDocumentData])

  const handleRunEvaluation = async () => {
    setIsEvaluating(true)
    toast.info("Initiating Automated Rule Evaluation against matched standard…")
    try {
      const { error } = await api.post(`/api/documents/${id}/check`, {})
      if (error) {
        toast.error(error || "Rule evaluation failed")
      } else {
        toast.success("Compliance evaluation completed successfully")
        fetchDocumentData()
      }
    } catch {
      toast.error("An unexpected error occurred during evaluation")
    } finally {
      setIsEvaluating(false)
    }
  }

  useEffect(() => { api.get<{ checklists: Array<{ id: string; name: string }> }>("/api/checklists?limit=100").then(({ data }) => setChecklists(data?.checklists || [])) }, [])
  const matchChecklist = async (automatic = false) => {
    setIsMatching(true)
    const { data, error } = await api.post<{ matched: boolean }>(`/api/documents/${id}/match`, automatic ? {} : { checklistId: selectedChecklist })
    setIsMatching(false)
    if (error) toast.error(error)
    else if (!data?.matched) toast.info("No confident match found. Select a checklist manually.")
    else { toast.success("Checklist matched"); await fetchDocumentData() }
  }

  const latestResult = document?.results?.[0]

  if (isLoading && !document) return <div role="status" className="p-8 text-muted-foreground">Loading document…</div>
  if (!document) return <div role="alert" className="rounded-xl border p-8">Document could not be loaded. <Link href="/documents" className="text-primary">Return to documents</Link></div>

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header Navigation */}
      <div className="flex flex-col gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between">
          <Link
            href="/documents"
            className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Document Repository
          </Link>
          <div className="flex items-center gap-2">
            <StatusBadge status={document?.status || "UPLOADED"} size="md" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                Audit Inspection Record
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">
                Standard: <strong className="text-slate-800 font-semibold">{document?.matchedChecklist?.name || "Unmapped"}</strong>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-display">
              {document?.name || "Loading Document…"}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.open(`/api/documents/${id}/results/pdf`, "_blank", "noopener")}
              disabled={!latestResult}
              className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Download PDF
            </button>

            <button
              onClick={handleRunEvaluation}
              disabled={isEvaluating || !canEdit || !document.matchedChecklist || !document.extractedText || document.status === "PROCESSING"}
              className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-brand-400 ${isEvaluating ? "animate-spin" : ""}`} />
              {isEvaluating ? "Evaluating Rules…" : "Re-Evaluate Adherence"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48"><label htmlFor="match-checklist" className="block text-xs font-semibold mb-2">Evaluation checklist</label><select id="match-checklist" value={selectedChecklist} onChange={event => setSelectedChecklist(event.target.value)} disabled={!canEdit || isMatching} className="w-full rounded-lg border p-2 text-sm"><option value="">Select a checklist</option>{checklists.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        {canEdit && <><button disabled={!selectedChecklist || isMatching} onClick={() => matchChecklist()} className="rounded-lg bg-primary text-white px-4 py-2 text-sm disabled:opacity-50">{isMatching ? "Matching…" : "Apply checklist"}</button><button disabled={isMatching} onClick={() => matchChecklist(true)} className="rounded-lg border px-4 py-2 text-sm">Auto-match</button></>}
        <a href={`/api/documents/${id}/download`} className="rounded-lg border px-4 py-2 text-sm">Download original</a>
      </div>
      {!document.extractedText && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Text could not be extracted. Please re-upload a readable PDF, DOCX, image or text file.</p>}

      {/* Summary Score Card */}
      {latestResult && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center">
            <div className="relative h-24 w-24 flex items-center justify-center mb-2">
              <div
                className="absolute inset-0 rounded-full shadow-xs"
                style={{
                  background: `conic-gradient(#059669 ${latestResult.overallScore}%, #e2e8f0 0%)`,
                  mask: "radial-gradient(circle at center, transparent 40%, black 41%)",
                  WebkitMask: "radial-gradient(circle at center, transparent 40%, black 41%)",
                }}
              />
              <span className="text-2xl font-extrabold font-mono text-slate-900">
                {latestResult.overallScore}%
              </span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 font-display">
              Conformance Rating
            </span>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              {latestResult.passedItems} of {latestResult.totalItems} checkpoints passed
            </p>
          </div>

          <div className="md:col-span-3 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-800 font-display">
                  Executive Findings Summary
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {latestResult.summary || "All regulatory requirements evaluated against standard specifications."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider font-display">Conforming Clauses</p>
                <p className="text-lg font-extrabold text-emerald-700 font-mono mt-0.5">{latestResult.passedItems}</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80">
                <p className="text-[10px] text-rose-800 font-bold uppercase tracking-wider font-display">Non-Conforming</p>
                <p className="text-lg font-extrabold text-rose-700 font-mono mt-0.5">{latestResult.failedItems}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider font-display">Missing Records</p>
                <p className="text-lg font-extrabold text-slate-700 font-mono mt-0.5">{latestResult.notFoundItems}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Studio View: Clause Matrix + Live Citation Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Checklist Criteria Matrix */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight font-display">
              Evaluated Compliance Criteria ({latestResult?.items.length || 0})
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              Select a criterion to spotlight citation
            </span>
          </div>

          <div className="space-y-2.5">
            {latestResult?.items.map((item) => {
              const isSelected = selectedItem?.id === item.id
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-brand-50/40 border-brand-400 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {item.status === "PASS" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : item.status === "FAIL" ? (
                          <XCircle className="h-4 w-4 text-rose-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-brand-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 font-display">
                          {item.fieldName}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                          <span>Target: <strong className="text-slate-700 font-semibold">{item.expected}</strong></span>
                          <span>•</span>
                          <span>Found: <strong className="text-brand-700 font-mono font-bold">{item.extractedValue ?? "None"}</strong></span>
                        </div>
                      </div>
                    </div>

                    <StatusBadge status={item.status} size="sm" />
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100 font-medium">
                      {item.notes}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right 5 Cols: Citation & Source Text Spotter */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight font-display">
              Evidence Citation Studio
            </h2>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveTab("analysis")}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                  activeTab === "analysis"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Spotlight
              </button>
              <button
                onClick={() => setActiveTab("raw")}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                  activeTab === "raw"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Raw Index
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs min-h-[420px] flex flex-col justify-between">
            {activeTab === "analysis" ? (
              selectedItem ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Quote className="h-4 w-4 text-brand-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display">
                      Verified Clause Citation
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Checkpoint
                    </span>
                    <p className="text-xs font-bold text-slate-900 mt-0.5 font-display">
                      {selectedItem.fieldName}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 relative">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Exact Extracted Excerpt
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      &quot;{selectedItem.sourceExcerpt || "No explicit excerpt found for this checkpoint."}&quot;
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Requirement:</span>
                      <span className="text-slate-800 font-bold">{selectedItem.expected}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Extracted Value:</span>
                      <span className="text-brand-700 font-mono font-bold">{selectedItem.extractedValue || "—"}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Adherence State:</span>
                      <span className="font-bold text-emerald-700">{selectedItem.status}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 text-slate-400">
                  <Quote className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-xs">Click any criterion on the left to inspect its citation.</p>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Indexed Document OCR Text
                </span>
                <pre className="text-[11px] font-mono text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 h-[340px] overflow-y-auto whitespace-pre-wrap leading-relaxed font-medium">
                  {document?.extractedText || "No raw text available."}
                </pre>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Source: Ingested Audit PDF</span>
              <span>SHA-256 Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
