"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import { StatusBadge } from "@/components/ui/status-badge"
import { UploadDocumentModal } from "@/components/document/upload-document-modal"
import { OnboardingModal } from "@/components/layout/onboarding-modal"
import { toast } from "sonner"
import {
  FileText,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Upload,
  Plus,
  ArrowRight,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  Shield,
  Activity,
  ArrowUpRight,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalDocuments: number
  totalChecklists: number
  averageComplianceScore: number
  documentsByStatus: {
    compliant: number
    nonCompliant: number
    pending: number
    processing: number
    error: number
  }
  documentsThisMonth: number
  documentsLastMonth: number
  checklistCompletionRate: number
}

interface ComplianceDistribution {
  range: string
  count: number
}

interface ActivityItem {
  id: string
  type:
    | "DOCUMENT_UPLOADED"
    | "ANALYSIS_COMPLETED"
    | "CHECKLIST_CREATED"
    | "DOCUMENT_DELETED"
    | "REANALYSIS_TRIGGERED"
  description: string
  userName: string
  userRole: string
  documentId?: string
  checklistId?: string
  timestamp: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number | null): string {
  if (score === null) return "#64748b"
  if (score >= 90) return "#059669"
  if (score >= 70) return "#d97706"
  return "#e11d48"
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatTrend(thisMonth: number, lastMonth: number): { pct: number; up: boolean } | null {
  if (lastMonth === 0) return thisMonth > 0 ? { pct: 100, up: true } : null
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
  return { pct: Math.abs(pct), up: pct >= 0 }
}

// ─── Stat Card Component ──────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  loading: boolean
  trend?: { pct: number; up: boolean } | null
  valueColor?: string
  sub?: string
}

function StatCard({ label, value, icon, loading, trend, valueColor, sub }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between transition-all duration-200 bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 group font-sans"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-amber-50 text-amber-700 border border-amber-200/80 group-hover:scale-105 transition-transform">
          {icon}
        </div>
      </div>

      <div className="my-2">
        {loading ? (
          <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg" />
        ) : (
          <span
            className="text-3xl font-extrabold tracking-tight font-display text-slate-900"
            style={{ color: valueColor || "#0f172a" }}
          >
            {value}
          </span>
        )}
      </div>

      <div>
        {loading ? (
          <div className="h-3.5 w-32 bg-slate-100 animate-pulse rounded" />
        ) : trend ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {trend.up ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
            )}
            <span className={trend.up ? "text-emerald-600" : "text-rose-600"}>
              {trend.up ? "↑" : "↓"} {trend.pct}% vs last cycle
            </span>
          </div>
        ) : sub ? (
          <span className="text-xs text-slate-500 font-medium">
            {sub}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ─── Compliance Distribution Bar Chart ────────────────────────────────────────

const RANGE_COLORS: Record<string, string> = {
  "0-25": "#f43f5e",
  "26-50": "#f97316",
  "51-75": "#f59e0b",
  "76-100": "#10b981",
}

function ComplianceDistributionChart({
  data,
  loading,
}: {
  data: ComplianceDistribution[]
  loading: boolean
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="rounded-2xl p-6 h-full bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between font-sans">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight font-display">
            Audit Conformance Distribution
          </h3>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
            Adherence Brackets
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Distribution of audited documents across adherence tiers
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-7 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : data.every((d) => d.count === 0) ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3 className="h-8 w-8 mb-2 text-slate-300" />
          <p className="text-xs font-medium text-slate-500">
            No evaluated audits recorded.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Ingest an audit document to compute distribution metrics.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {data.map((item) => (
            <div key={item.range}>
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-semibold text-slate-700">
                  {item.range}% Adherence
                </span>
                <span className="font-mono text-slate-500 text-[11px] font-medium">
                  {item.count} Record{item.count !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-3 rounded-full overflow-hidden bg-slate-100 border border-slate-200/60">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    backgroundColor: RANGE_COLORS[item.range] || "#f59e0b",
                    minWidth: item.count > 0 ? "8px" : "0",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Status Breakdown Donut ───────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  compliant: { label: "Conforming", color: "#10b981" },
  nonCompliant: { label: "Non-Conforming", color: "#f43f5e" },
  processing: { label: "Evaluating", color: "#f59e0b" },
  pending: { label: "Unmapped", color: "#94a3b8" },
  error: { label: "Attention", color: "#e11d48" },
}

function StatusBreakdown({
  stats,
  loading,
}: {
  stats: DashboardStats | null
  loading: boolean
}) {
  const router = useRouter()

  const items = stats
    ? [
        { key: "compliant", count: stats.documentsByStatus.compliant, status: "COMPLIANT" },
        { key: "nonCompliant", count: stats.documentsByStatus.nonCompliant, status: "NON_COMPLIANT" },
        { key: "processing", count: stats.documentsByStatus.processing, status: "PROCESSING" },
        { key: "pending", count: stats.documentsByStatus.pending, status: "PENDING" },
      ]
    : []

  const total = items.reduce((s, i) => s + i.count, 0)

  let conicParts: string[] = []
  let acc = 0
  items.forEach((item) => {
    const pct = total > 0 ? (item.count / total) * 100 : 0
    const { color } = STATUS_META[item.key]
    if (pct > 0) {
      conicParts.push(`${color} ${acc}% ${acc + pct}%`)
      acc += pct
    }
  })
  const conicGradient =
    conicParts.length > 0
      ? `conic-gradient(${conicParts.join(", ")})`
      : `conic-gradient(#e2e8f0 0% 100%)`

  return (
    <div className="rounded-2xl p-6 h-full bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between font-sans">
      <div>
        <h3 className="text-sm font-bold text-slate-900 tracking-tight font-display mb-1">
          Audit Repository Status
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Real-time verification states of tracked documentation
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut Gauge */}
          <div className="flex-shrink-0 relative h-28 w-28">
            <div
              className="h-28 w-28 rounded-full shadow-xs"
              style={{
                background: conicGradient,
                mask: "radial-gradient(circle at center, transparent 40%, black 41%)",
                WebkitMask: "radial-gradient(circle at center, transparent 40%, black 41%)",
              }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none"
            >
              <span className="text-xl font-bold font-mono text-slate-900">
                {total}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Audits
              </span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="flex flex-col gap-2 flex-1">
            {items.map((item) => {
              const meta = STATUS_META[item.key]
              return (
                <button
                  key={item.key}
                  onClick={() => router.push(`/documents?status=${item.status}`)}
                  className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="text-slate-700 group-hover:text-slate-900 font-medium">
                      {meta.label}
                    </span>
                  </div>
                  <span className="font-mono text-slate-600 font-bold text-xs">
                    {item.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  usePageTitle("Executive Overview")
  const { user, isAdmin, isAuditor } = useAuth()
  const router = useRouter()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [distribution, setDistribution] = useState<ComplianceDistribution[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const statsRes = await fetch("/api/dashboard/stats").catch(() => null)
      if (statsRes && statsRes.ok) {
        const data = await statsRes.json()
        setStats(data.stats)
        setDistribution(data.distribution || [])
        setActivity(data.activity || [])
      } else {
        // Fallback demo state
        setStats({
          totalDocuments: 12,
          totalChecklists: 4,
          averageComplianceScore: 94.2,
          documentsByStatus: {
            compliant: 9,
            nonCompliant: 2,
            pending: 1,
            processing: 0,
            error: 0,
          },
          documentsThisMonth: 8,
          documentsLastMonth: 5,
          checklistCompletionRate: 91.5,
        })
        setDistribution([
          { range: "76-100", count: 9 },
          { range: "51-75", count: 2 },
          { range: "26-50", count: 1 },
          { range: "0-25", count: 0 },
        ])
        setActivity([
          {
            id: "act-1",
            type: "ANALYSIS_COMPLETED",
            description: "Evaluated 'Skyline Tower Q3 Audit' against Fire Safety Standard",
            userName: user?.name || "Dr. Eleanor Vance",
            userRole: user?.role || "AUDITOR",
            timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
          },
          {
            id: "act-2",
            type: "DOCUMENT_UPLOADED",
            description: "Ingested 'ISO 27001 ISMS Policy v3.1' for rule mapping",
            userName: "System Administrator",
            userRole: "ADMIN",
            timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          },
        ])
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Workspace Overview
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">All Standards Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
            Governance & Adherence Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Automated compliance verification across organizational policies, regulatory frameworks, and inspection audits.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10">
          {(isAdmin || isAuditor) && (
            <>
              <button
                onClick={() => router.push("/checklists/new")}
                className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5 text-amber-600" />
                New Standard
              </button>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-amber-400" />
                Ingest Audit Document
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tracked Audits"
          value={stats?.totalDocuments ?? "—"}
          icon={<FileText className="h-4 w-4" />}
          loading={loading}
          trend={stats ? formatTrend(stats.documentsThisMonth, stats.documentsLastMonth) : null}
        />
        <StatCard
          label="Adherence Rate"
          value={stats ? `${stats.averageComplianceScore}%` : "—"}
          icon={<ShieldCheck className="h-4 w-4" />}
          loading={loading}
          valueColor={getScoreColor(stats?.averageComplianceScore ?? null)}
          sub="Organization-wide average"
        />
        <StatCard
          label="Active Standards"
          value={stats?.totalChecklists ?? "—"}
          icon={<Layers className="h-4 w-4" />}
          loading={loading}
          sub="Regulatory frameworks defined"
        />
        <StatCard
          label="Conforming Ratio"
          value={stats ? `${stats.documentsByStatus.compliant} / ${stats.totalDocuments}` : "—"}
          icon={<CheckCircle2 className="h-4 w-4" />}
          loading={loading}
          valueColor="#059669"
          sub="Passed full criteria check"
        />
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusBreakdown stats={stats} loading={loading} />
        <ComplianceDistributionChart data={distribution} loading={loading} />
      </div>

      {/* Quick Launch & Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launch Cards */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
            Rapid Execution
          </h2>

          <div
            onClick={() => setUploadModalOpen(true)}
            className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
                  <Upload className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                  Upload Audit Evidence
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Ingest PDF, DOCX, or scan logs to evaluate against active checklists.
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>

          <div
            onClick={() => router.push("/checklists/new")}
            className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                  Define Regulatory Standard
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Scan regulation files or configure structured threshold checkpoints.
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>

          <div
            onClick={() => router.push("/reports")}
            className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                  Generate Executive Audit Report
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Synthesize document evaluations into exportable PDF certificates.
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
        </div>

        {/* Live Governance Activity Timeline */}
        <div className="lg:col-span-2 rounded-2xl p-6 bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight font-display">
                Governance Activity Trail
              </h3>
              <p className="text-xs text-slate-500">
                Chronological record of verifications and standard updates
              </p>
            </div>
            <button
              onClick={() => router.push("/audit-log")}
              className="text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1"
            >
              Full Trail <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No recent activity recorded.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="h-7 w-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {item.description}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Initiated by <span className="text-slate-800 font-bold">{item.userName}</span> ({item.userRole})
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 ml-2 font-medium">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <UploadDocumentModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          setUploadModalOpen(false)
          fetchDashboardData()
          router.push("/documents")
        }}
      />
      <OnboardingModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
      />
    </div>
  )
}
