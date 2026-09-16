"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { usePageTitle } from "@/lib/use-page-title"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
} from "lucide-react"

interface DocumentDetail {
  id: string
  name: string
  fileName: string
  fileSize: number
  mimeType: string
  status: "PENDING" | "PROCESSING" | "COMPLIANT" | "NON_COMPLIANT" | "ERROR"
  complianceScore: number | null
  uploadedBy: { id: string; name: string; role: string } | null
  createdAt: string
  updatedAt: string
  checklistId: string | null
  checklistName: string | null
}

interface ComplianceAnalysis {
  documentId: string
  overallScore: number
  status: "COMPLIANT" | "NON_COMPLIANT"
  evaluatedAt: string
  sections: ComplianceSection[]
  summary: string
}

interface ComplianceSection {
  id: string
  title: string
  score: number
  status: "PASS" | "FAIL" | "WARNING"
  findings: Finding[]
}

interface Finding {
  id: string
  clause: string
  result: "PASS" | "FAIL" | "WARNING"
  detail: string
  recommendation: string | null
}

export default function DocumentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { canEdit, isAdmin } = useAuth()

  const [document, setDocument] = useState<DocumentDetail | null>(null)
  const [analysis, setAnalysis] = useState<ComplianceAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  usePageTitle(document?.name || "Document Detail")
  
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [showReanalyzeDialog, setShowReanalyzeDialog] = useState(false)
  
  // Polling ref to easily clear it on unmount
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchDocumentData = useCallback(async () => {
    try {
      const { data: docData, error: docError } = await api.get(`/api/documents/${id}`)
      if (docError) {
        if (docError.includes("404")) setError("NOT_FOUND")
        else setError("Failed to load document metadata")
        setIsLoading(false)
        return
      }

      setDocument(docData)

      // If document is in terminal state, fetch analysis
      if (docData.status === "COMPLIANT" || docData.status === "NON_COMPLIANT") {
        const { data: analysisData, error: analysisError } = await api.get(
          `/api/documents/${id}/analysis`
        )
        if (!analysisError && analysisData) {
          setAnalysis(analysisData)
        }
      } else {
        setAnalysis(null)
      }

      setIsLoading(false)

      // Polling logic for in-progress states
      if (docData.status === "PENDING" || docData.status === "PROCESSING") {
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(async () => {
            const { data: pollData } = await api.get(`/api/documents/${id}`)
            if (pollData) {
              setDocument(pollData)
              if (
                pollData.status === "COMPLIANT" ||
                pollData.status === "NON_COMPLIANT" ||
                pollData.status === "ERROR"
              ) {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
                
                // Fetch analysis if terminal success
                if (pollData.status === "COMPLIANT" || pollData.status === "NON_COMPLIANT") {
                  const { data: finalAnalysis } = await api.get(`/api/documents/${id}/analysis`)
                  if (finalAnalysis) setAnalysis(finalAnalysis)
                }
              }
            }
          }, 5000)
        }
      } else {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    } catch (err) {
      setError("An unexpected error occurred")
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDocumentData()
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [fetchDocumentData])

  const handleReanalyze = async () => {
    setIsReanalyzing(true)
    const { error: reanalyzeError } = await api.post(`/api/documents/${id}/reanalyze`)
    
    if (reanalyzeError) {
      toast.error(reanalyzeError)
    } else {
      toast.success("Re-analysis triggered successfully")
      setShowReanalyzeDialog(false)
      // Optimistically update document status to processing to show loader
      setDocument((prev) => prev ? { ...prev, status: "PROCESSING" } : prev)
      setAnalysis(null)
      fetchDocumentData() // Restart polling
    }
    setIsReanalyzing(false)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getScoreColor = (score: number | null): string => {
    if (score === null) return "var(--text-muted)"
    if (score >= 100) return "var(--success)"
    if (score >= 70) return "var(--warning)"
    return "var(--error)"
  }

  const getFindingIcon = (result: "PASS" | "FAIL" | "WARNING") => {
    if (result === "PASS") return <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} />
    if (result === "FAIL") return <XCircle className="h-4 w-4" style={{ color: "var(--error)" }} />
    return <AlertTriangle className="h-4 w-4" style={{ color: "var(--warning)" }} />
  }

  if (error === "NOT_FOUND") {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <h2 className="text-2xl font-display mb-2" style={{ color: "var(--text-primary)" }}>Document Not Found</h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          The document you're looking for doesn't exist or has been deleted.
        </p>
        <button
          onClick={() => router.push("/documents")}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: "var(--green-600)", color: "white" }}
        >
          Return to Documents
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="animate-fade-up max-w-5xl mx-auto space-y-6">
        <div className="h-6 w-48 rounded animate-shimmer-green" />
        <div className="h-32 rounded-xl animate-shimmer-green" />
        <div className="h-48 rounded-xl animate-shimmer-green" />
        <div className="space-y-4">
          <div className="h-16 rounded-xl animate-shimmer-green" />
          <div className="h-16 rounded-xl animate-shimmer-green" />
        </div>
      </div>
    )
  }

  if (!document) return null

  const isProcessing = document.status === "PENDING" || document.status === "PROCESSING"
  const isTerminal = document.status === "COMPLIANT" || document.status === "NON_COMPLIANT"
  const isError = document.status === "ERROR"

  return (
    <div className="animate-fade-up max-w-5xl mx-auto pb-12">
      {/* Breadcrumb / Back Navigation */}
      <button
        onClick={() => router.push("/documents")}
        className="flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to documents
      </button>

      {/* Header Area */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-display" style={{ color: "var(--text-primary)" }}>
                {document.name}
              </h1>
              <StatusBadge status={document.status} size="md" />
            </div>
            <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {document.uploadedBy?.name || "Unknown"}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(document.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                {formatFileSize(document.fileSize)}
              </span>
            </div>
            {document.checklistId && (
              <div className="mt-3 text-sm">
                <span style={{ color: "var(--text-muted)" }}>Evaluated against: </span>
                <Link
                  href={`/checklists/${document.checklistId}`}
                  className="font-medium hover:underline transition-all"
                  style={{ color: "var(--green-400)" }}
                >
                  {document.checklistName || "Unknown Checklist"}
                </Link>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {isTerminal && (
              <button
                onClick={() => window.open(`/api/documents/${document.id}/pdf`, "_blank")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--glow-soft)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                }}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            )}
            
            {canEdit && (
              <button
                onClick={() => setShowReanalyzeDialog(true)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "var(--bg-deep)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.borderColor = "var(--green-500)"
                    e.currentTarget.style.color = "var(--green-400)"
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.color = "var(--text-primary)"
                }}
              >
                <RefreshCw className={`h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
                Re-analyze
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div
          className="rounded-xl p-12 flex flex-col items-center justify-center text-center animate-fade-in"
          style={{
            background: "var(--bg-surface)",
            border: "1px dashed var(--border)",
          }}
        >
          <div className="relative mb-6">
            <div className="h-16 w-16 rounded-full flex items-center justify-center bg-transparent relative z-10">
              <RefreshCw className="h-8 w-8 animate-spin" style={{ color: "var(--green-400)" }} />
            </div>
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: "var(--green-500)" }}
            />
          </div>
          <h2 className="text-lg font-display mb-2" style={{ color: "var(--text-primary)" }}>
            Analysis in Progress
          </h2>
          <p className="text-sm max-w-md" style={{ color: "var(--text-muted)" }}>
            The AI engine is currently scanning the document and matching values against the target checklist. This usually takes 15–30 seconds.
          </p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div
          className="rounded-xl p-8 flex flex-col items-center justify-center text-center animate-fade-in"
          style={{
            background: "rgba(248, 113, 113, 0.05)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
          }}
        >
          <AlertTriangle className="h-10 w-10 mb-4" style={{ color: "var(--error)" }} />
          <h2 className="text-lg font-display mb-2" style={{ color: "var(--error)" }}>
            Analysis Failed
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            An error occurred while processing this document. Please try again or contact support.
          </p>
          {canEdit && (
            <button
              onClick={() => setShowReanalyzeDialog(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: "var(--error)", color: "white" }}
            >
              Retry Analysis
            </button>
          )}
        </div>
      )}

      {/* Compliance Results */}
      {isTerminal && analysis && (
        <div className="space-y-6 animate-fade-in">
          {/* Hero Score Section */}
          <div
            className="rounded-xl p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Background glow based on score */}
            <div 
              className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none"
              style={{ background: getScoreColor(analysis.overallScore) }}
            />

            <div className="flex-shrink-0 relative flex items-center justify-center h-32 w-32 rounded-full border-4" style={{ borderColor: getScoreColor(analysis.overallScore) }}>
              <span className="text-4xl font-mono font-bold" style={{ color: getScoreColor(analysis.overallScore) }}>
                {Math.round(analysis.overallScore)}%
              </span>
            </div>
            
            <div className="flex-1 text-center md:text-left z-10">
              <h2 
                className="text-2xl font-display mb-3" 
                style={{ color: analysis.status === "COMPLIANT" ? "var(--success)" : "var(--error)" }}
              >
                {analysis.status === "COMPLIANT" ? "Document is Compliant" : "Document is Non-Compliant"}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {analysis.summary}
              </p>
            </div>
          </div>

          {/* Sections Breakdown */}
          <h3 className="text-lg font-display mt-8 mb-4" style={{ color: "var(--text-primary)" }}>
            Compliance Breakdown
          </h3>
          
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <Accordion type="multiple" className="w-full">
              {analysis.sections.map((section, idx) => (
                <AccordionItem 
                  key={section.id} 
                  value={section.id} 
                  className="px-6 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <AccordionTrigger className="hover:no-underline py-5">
                    <div className="flex items-center justify-between w-full pr-4">
                      <span className="font-medium text-sm md:text-base text-left" style={{ color: "var(--text-primary)" }}>
                        {section.title}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-mono font-bold" style={{ color: getScoreColor(section.score) }}>
                          {Math.round(section.score)}%
                        </span>
                        <StatusBadge status={section.status} size="sm" />
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="pb-6 pt-2">
                    <div className="space-y-4">
                      {section.findings.map((finding) => (
                        <div 
                          key={finding.id} 
                          className="rounded-lg p-4 transition-colors"
                          style={{
                            background: "var(--bg-deep)",
                            borderLeft: `3px solid ${
                              finding.result === "PASS" ? "var(--success)" : 
                              finding.result === "FAIL" ? "var(--error)" : "var(--warning)"
                            }`
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0">
                              {getFindingIcon(finding.result)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                                  {finding.clause}
                                </span>
                              </div>
                              <p className="text-sm mb-2" style={{ color: "var(--text-primary)" }}>
                                {finding.detail}
                              </p>
                              {finding.recommendation && (
                                <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                                  Recommendation: {finding.recommendation}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {section.findings.length === 0 && (
                        <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                          No findings reported for this section.
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      )}

      {/* Reanalyze Confirmation Dialog */}
      <ConfirmDialog
        open={showReanalyzeDialog}
        onOpenChange={setShowReanalyzeDialog}
        title="Re-analyze Document"
        description="Are you sure you want to trigger a re-analysis? This will clear current results and run the document against the checklist again using AI models. This process may take a minute."
        confirmLabel="Re-analyze"
        onConfirm={handleReanalyze}
        isLoading={isReanalyzing}
      />
    </div>
  )
}
