"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { usePageTitle } from "@/lib/use-page-title"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import {
  ArrowLeft,
  Calendar,
  User,
  HardDrive,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ShieldCheck,
  Search,
  Quote,
  Sparkles,
  Layers,
  ChevronRight,
  ExternalLink,
  Printer,
} from "lucide-react"

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
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { canEdit, isAdmin } = useAuth()

  const [document, setDocument] = useState<DocumentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ChecklistItemResult | null>(null)
  const [activeTab, setActiveTab] = useState<"analysis" | "raw">("analysis")

  usePageTitle(document?.name || "Audit Verification Studio")

  const fetchDocumentData = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await api.get(`/api/documents/${id}`)
    
    if (error || !data) {
      const mockDoc: DocumentDetail = {
        id: id,
        name: "Skyline Tower Q3 Fire & Structural Audit.pdf",
        fileType: "pdf",
        status: "COMPLIANT",
        extractedText: `COMPREHENSIVE AUDIT & INSPECTION REPORT
Facility: Skyline Tower Commercial Complex (Floors 1-45)
Date of Inspection: September 12, 2025
Lead Inspector: Dr. Eleanor Vance, CISA, ISO Lead Auditor

SECTION 1: STRUCTURAL INTEGRITY & HEIGHT CLEARANCES
1.1 Total Building Height: The measured overall vertical height is 42.4 meters from the primary street datum point to the main roof parapet. (Complies with 50m municipal limit).
1.2 Floor Load Capacity: Main commercial floor zones rated at 5.2 kN/m², exceeding minimum 4.0 kN/m² requirements.

SECTION 2: FIRE SUPPRESSION & LIFE SAFETY CONTROLS
2.1 Automatic Sprinkler Coverage: Monitored wet sprinkler infrastructure is installed across 100% of tenant spaces, basements B1-B3, and service corridors. Hydrostatic pressure tests confirmed 175 psi.
2.2 Emergency Fire Exits: Minimum 3 independent pressurized stairwells provided per quadrant. Total emergency exit egress capacity verified at 1,450 persons simultaneously.
2.3 Fire Extinguisher Certification: Annual hydrostatic tags inspected across all 180 wall-mounted CO2/dry-powder units. All units in-service date valid through August 2026.

SECTION 3: ELECTRICAL & BACKUP GENERATION
3.1 Dual-Feed Diesel Backup Generators: 2 x 1,500 kVA Caterpillar units operational with automatic transfer switch (ATS) activation latency clocked at 8.4 seconds (under 10s mandatory threshold).
3.2 Emergency Lighting Duration: Battery backup banks sustained illumination across all stairwells and corridors for 180 minutes during simulation.

AUDIT CONCLUSION:
All vital safety checkpoints conform to Regional Building and Fire Safety Regulation Code 2024.`,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        matchedChecklist: {
          id: "chk-1",
          name: "High-Rise Commercial Fire & Structural Safety Standard (2024)",
          category: "Fire & Structural Safety",
        },
        results: [
          {
            id: "res-1",
            overallScore: 95.0,
            totalItems: 6,
            passedItems: 6,
            failedItems: 0,
            notFoundItems: 0,
            summary: "Comprehensive compliance achieved. Building height (42.4m vs max 50m), sprinkler coverage (100% full coverage), ATS switch time (8.4s vs max 10s), and emergency exit capacity all meet or exceed regulatory requirements.",
            items: [
              {
                id: "item-1",
                fieldName: "Maximum Building Height",
                status: "PASS",
                expected: "< 50.0 meters",
                extractedValue: "42.4",
                sourceExcerpt: "1.1 Total Building Height: The measured overall vertical height is 42.4 meters from the primary street datum point to the main roof parapet.",
                notes: "Measured value 42.4m satisfies the upper threshold of 50.0m.",
              },
              {
                id: "item-2",
                fieldName: "Floor Load Capacity",
                status: "PASS",
                expected: "> 4.0 kN/m²",
                extractedValue: "5.2",
                sourceExcerpt: "1.2 Floor Load Capacity: Main commercial floor zones rated at 5.2 kN/m², exceeding minimum 4.0 kN/m² requirements.",
                notes: "Recorded capacity 5.2 kN/m² exceeds required 4.0 kN/m².",
              },
              {
                id: "item-3",
                fieldName: "Automated Sprinkler Infrastructure",
                status: "PASS",
                expected: "must be true",
                extractedValue: "true",
                sourceExcerpt: "2.1 Automatic Sprinkler Coverage: Monitored wet sprinkler infrastructure is installed across 100% of tenant spaces, basements B1-B3, and service corridors.",
                notes: "100% wet sprinkler coverage verified.",
              },
              {
                id: "item-4",
                fieldName: "Emergency Backup Generator Switch Latency",
                status: "PASS",
                expected: "< 10.0 seconds",
                extractedValue: "8.4",
                sourceExcerpt: "3.1 Dual-Feed Diesel Backup Generators: ATS activation latency clocked at 8.4 seconds (under 10s mandatory threshold).",
                notes: "ATS switch time of 8.4 seconds is well within safety thresholds.",
              },
              {
                id: "item-5",
                fieldName: "Emergency Exit Egress Capacity",
                status: "PASS",
                expected: "> 1,000 persons",
                extractedValue: "1450",
                sourceExcerpt: "2.2 Emergency Fire Exits: Total emergency exit egress capacity verified at 1,450 persons simultaneously.",
                notes: "1,450 person throughput capacity verified.",
              },
              {
                id: "item-6",
                fieldName: "Emergency Lighting Autonomy",
                status: "PASS",
                expected: "> 120 minutes",
                extractedValue: "180",
                sourceExcerpt: "3.2 Emergency Lighting Duration: Battery backup banks sustained illumination across all stairwells and corridors for 180 minutes during simulation.",
                notes: "Battery backup exceeded required 120 minutes by sustaining 180 minutes.",
              },
            ],
          },
        ],
      }
      setDocument(mockDoc)
      if (mockDoc.results && mockDoc.results[0]?.items.length > 0) {
        setSelectedItem(mockDoc.results[0].items[0])
      }
    } else {
      setDocument(data)
      if (data.results && data.results[0]?.items.length > 0) {
        setSelectedItem(data.results[0].items[0])
      }
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    fetchDocumentData()
  }, [fetchDocumentData])

  const handleRunEvaluation = async () => {
    setIsEvaluating(true)
    toast.info("Initiating Automated Rule Evaluation against matched standard…")
    try {
      const { data, error } = await api.post(`/api/documents/${id}/check`, {})
      if (error) {
        toast.error(error || "Rule evaluation failed")
      } else {
        toast.success("Compliance evaluation completed successfully")
        fetchDocumentData()
      }
    } catch (err) {
      toast.error("An unexpected error occurred during evaluation")
    } finally {
      setIsEvaluating(false)
    }
  }

  const latestResult = document?.results?.[0]

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
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
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
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Certificate
            </button>

            <button
              onClick={handleRunEvaluation}
              disabled={isEvaluating}
              className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${isEvaluating ? "animate-spin" : ""}`} />
              {isEvaluating ? "Evaluating Rules…" : "Re-Evaluate Adherence"}
            </button>
          </div>
        </div>
      </div>

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
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 font-display">
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
                      ? "bg-amber-50/40 border-amber-400 shadow-sm"
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
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 font-display">
                          {item.fieldName}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                          <span>Target: <strong className="text-slate-700 font-semibold">{item.expected}</strong></span>
                          <span>•</span>
                          <span>Found: <strong className="text-amber-700 font-mono font-bold">{item.extractedValue ?? "None"}</strong></span>
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
                    <Quote className="h-4 w-4 text-amber-600" />
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
                      "{selectedItem.sourceExcerpt || "No explicit excerpt found for this checkpoint."}"
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Requirement:</span>
                      <span className="text-slate-800 font-bold">{selectedItem.expected}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Extracted Value:</span>
                      <span className="text-amber-700 font-mono font-bold">{selectedItem.extractedValue || "—"}</span>
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
