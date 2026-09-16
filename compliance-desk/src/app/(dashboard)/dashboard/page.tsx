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
  ListChecks,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Upload,
  Plus,
  ArrowRight,
  Upload as UploadIcon,
  RefreshCw,
  Trash2,
  CheckCircle2,
  List,
  Activity,
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
  if (score === null) return "var(--text-muted)"
  if (score >= 100) return "var(--success)"
  if (score >= 70) return "var(--warning)"
  return "var(--error)"
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded animate-shimmer-green ${className}`} style={{ minHeight: 16 }} />
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

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
      className="rounded-xl p-6 relative overflow-hidden flex flex-col gap-2 transition-all duration-200"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--green-700)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Background icon accent */}
      <div
        className="absolute right-4 top-4 opacity-5 pointer-events-none"
        style={{ color: "var(--green-400)", transform: "scale(3)" }}
      >
        {icon}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--green-500)" }}
        >
          {icon}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-9 w-24 mt-1" />
      ) : (
        <span
          className="text-3xl font-display font-bold mt-1"
          style={{ color: valueColor || "var(--text-primary)" }}
        >
          {value}
        </span>
      )}

      {loading ? (
        <Skeleton className="h-4 w-32" />
      ) : trend ? (
        <div className="flex items-center gap-1.5 text-xs">
          {trend.up ? (
            <TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" style={{ color: "var(--error)" }} />
          )}
          <span style={{ color: trend.up ? "var(--success)" : "var(--error)" }}>
            {trend.up ? "↑" : "↓"} {trend.pct}% from last month
          </span>
        </div>
      ) : sub ? (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </span>
      ) : null}
    </div>
  )
}

// ─── Compliance Distribution Bar Chart ────────────────────────────────────────

const RANGE_COLORS: Record<string, string> = {
  "0-25": "var(--error)",
  "26-50": "#f97316", // orange
  "51-75": "var(--warning)",
  "76-100": "var(--success)",
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
    <div
      className="rounded-xl p-6 h-full"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Compliance Score Distribution
      </h3>
      <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
        Documents grouped by overall compliance score range
      </p>

      {loading ? (
        <div className="space-y-4 mt-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : data.every((d) => d.count === 0) ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <BarChart2 className="h-10 w-10 mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No compliance data yet.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Upload your first document to begin.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.range}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {item.range}%
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  {item.count} doc{item.count !== 1 ? "s" : ""}
                </span>
              </div>
              <div
                className="h-6 rounded-md overflow-hidden"
                style={{ background: "var(--bg-deep)" }}
              >
                <div
                  className="h-full rounded-md transition-all duration-700"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    background: RANGE_COLORS[item.range] || "var(--green-600)",
                    minWidth: item.count > 0 ? "8px" : "0",
                    opacity: 0.8,
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

// ─── Status Donut ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  compliant: { label: "Compliant", color: "var(--success)" },
  nonCompliant: { label: "Non-Compliant", color: "var(--error)" },
  processing: { label: "Processing", color: "var(--warning)" },
  pending: { label: "Pending", color: "#94a3b8" },
  error: { label: "Error", color: "#f87171" },
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
        { key: "error", count: stats.documentsByStatus.error, status: "ERROR" },
      ]
    : []

  const total = items.reduce((s, i) => s + i.count, 0)

  // Build CSS conic gradient for donut
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
      : `conic-gradient(var(--bg-deep) 0% 100%)`

  return (
    <div
      className="rounded-xl p-6 h-full"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Document Status Breakdown
      </h3>
      <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
        Click a status to filter the documents list
      </p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="flex-shrink-0 relative h-28 w-28">
            <div
              className="h-28 w-28 rounded-full"
              style={{
                background: conicGradient,
                mask: "radial-gradient(circle at center, transparent 38%, black 39%)",
                WebkitMask: "radial-gradient(circle at center, transparent 38%, black 39%)",
              }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center flex-col"
              style={{ pointerEvents: "none" }}
            >
              <span className="text-xl font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                {total}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                total
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 flex-1">
            {items.map((item) => {
              const meta = STATUS_META[item.key]
              return (
                <button
                  key={item.key}
                  onClick={() => router.push(`/documents?status=${item.status}`)}
                  className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg text-left transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glow-soft)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ background: meta.color }}
                    />
                    <span className="text-xs">{meta.label}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
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

// ─── Activity Feed ────────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  const cls = "h-4 w-4"
  const iconMap: Record<ActivityItem["type"], React.ReactNode> = {
    DOCUMENT_UPLOADED: <UploadIcon className={cls} />,
    ANALYSIS_COMPLETED: <CheckCircle2 className={cls} />,
    CHECKLIST_CREATED: <List className={cls} />,
    DOCUMENT_DELETED: <Trash2 className={cls} />,
    REANALYSIS_TRIGGERED: <RefreshCw className={cls} />,
  }
  const colorMap: Record<ActivityItem["type"], string> = {
    DOCUMENT_UPLOADED: "var(--green-400)",
    ANALYSIS_COMPLETED: "var(--success)",
    CHECKLIST_CREATED: "var(--green-500)",
    DOCUMENT_DELETED: "var(--error)",
    REANALYSIS_TRIGGERED: "var(--warning)",
  }
  return (
    <div
      className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center"
      style={{ background: "var(--bg-deep)", color: colorMap[type], border: "1px solid var(--border)" }}
    >
      {iconMap[type]}
    </div>
  )
}

function ActivityFeed({
  items,
  loading,
}: {
  items: ActivityItem[]
  loading: boolean
}) {
  const router = useRouter()

  return (
    <div
      className="rounded-xl h-full flex flex-col"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Activity className="h-4 w-4" style={{ color: "var(--green-400)" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Recent Activity
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 360 }}>
        {loading ? (
          <div className="space-y-4 p-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-10 w-10 mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No recent activity
            </p>
          </div>
        ) : (
          <div>
            {items.map((item, idx) => (
              <button
                key={item.id}
                className="w-full flex items-start gap-3 px-6 py-3.5 text-left transition-colors"
                style={{ borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none" }}
                onClick={() => {
                  if (item.documentId) router.push(`/documents/${item.documentId}`)
                  else if (item.checklistId) router.push(`/checklists/${item.checklistId}`)
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glow-soft)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <ActivityIcon type={item.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {item.userName}
                    </span>
                    <StatusBadge status={item.userRole} size="sm" />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      · {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions({
  canUpload,
  canEdit,
  onUploadClick,
}: {
  canUpload: boolean
  canEdit: boolean
  onUploadClick: () => void
}) {
  const router = useRouter()

  return (
    <div
      className="rounded-xl h-full flex flex-col"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <TrendingUp className="h-4 w-4" style={{ color: "var(--green-400)" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Quick Actions
        </h3>
      </div>
      <div className="p-6 space-y-3">
        {canUpload && (
          <button
            onClick={onUploadClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: "var(--green-600)",
              color: "white",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--green-500)"
              e.currentTarget.style.transform = "translateY(-1px)"
              e.currentTarget.style.boxShadow = "0 4px 12px var(--glow-green)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--green-600)"
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "none"
            }}
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </button>
        )}

        {canEdit && (
          <button
            onClick={() => router.push("/checklists/new")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: "var(--bg-deep)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--green-600)"
              e.currentTarget.style.color = "var(--green-400)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)"
              e.currentTarget.style.color = "var(--text-primary)"
            }}
          >
            <Plus className="h-4 w-4" />
            Create Checklist
          </button>
        )}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
          <button
            onClick={() => router.push("/documents")}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View All Documents
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => router.push("/checklists")}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              View All Checklists
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, canEdit, canUpload } = useAuth()
  usePageTitle("Dashboard")

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [distribution, setDistribution] = useState<ComplianceDistribution[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [statsError, setStatsError] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const fetchAll = useCallback(async () => {
    setStatsLoading(true)
    setActivityLoading(true)

    const [statsRes, activityRes] = await Promise.all([
      api.get("/api/dashboard/stats"),
      api.get("/api/dashboard/activity?limit=20"),
    ])

    if (statsRes.error) {
      setStatsError(true)
    } else if (statsRes.data) {
      // Map actual API shape to DashboardStats type
      const d = statsRes.data
      setStats({
        totalDocuments: d.totalDocuments ?? 0,
        totalChecklists: d.activeChecklists ?? 0,
        averageComplianceScore: d.complianceRate ?? 0,
        documentsByStatus: {
          compliant: d.breakdown?.compliant ?? 0,
          nonCompliant: d.breakdown?.nonCompliant ?? 0,
          pending: d.breakdown?.pending ?? 0,
          processing: 0,
          error: 0,
        },
        documentsThisMonth: d.documentsThisMonth ?? 0,
        documentsLastMonth: d.documentsLastMonth ?? 0,
        checklistCompletionRate: d.checklistCompletionRate ?? 0,
      })

      // Build distribution from byCategory or fallback to empty
      const dist: ComplianceDistribution[] = [
        { range: "0-25", count: 0 },
        { range: "26-50", count: 0 },
        { range: "51-75", count: 0 },
        { range: "76-100", count: 0 },
      ]
      if (d.byCategory?.length) {
        d.byCategory.forEach((cat: { avgScore: number; docCount: number }) => {
          const score = cat.avgScore
          if (score <= 25) dist[0].count += cat.docCount
          else if (score <= 50) dist[1].count += cat.docCount
          else if (score <= 75) dist[2].count += cat.docCount
          else dist[3].count += cat.docCount
        })
      }
      setDistribution(dist)
    }
    setStatsLoading(false)

    if (activityRes.data?.activities) {
      setActivity(activityRes.data.activities)
    }
    setActivityLoading(false)
  }, [])


  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const firstName = user?.name?.split(" ")[0] || "there"
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const trend = stats
    ? formatTrend(stats.documentsThisMonth, stats.documentsLastMonth)
    : null

  return (
    <div className="animate-fade-up space-y-8 pb-12">
      {/* Stats error banner */}
      {statsError && (
        <div
          className="rounded-lg px-4 py-3 text-sm flex items-center gap-3"
          style={{
            background: "rgba(248, 113, 113, 0.08)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
            color: "var(--error)",
          }}
        >
          <Activity className="h-4 w-4 flex-shrink-0" />
          Could not load dashboard statistics. Showing available data — please refresh to retry.
        </div>
      )}

      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {today}
          </p>
        </div>
      </div>

      {/* ── Stat Cards Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Documents"
          value={stats?.totalDocuments ?? "—"}
          icon={<FileText className="h-4 w-4" />}
          loading={statsLoading}
          trend={trend}
        />
        <StatCard
          label="Total Checklists"
          value={stats?.totalChecklists ?? "—"}
          icon={<ListChecks className="h-4 w-4" />}
          loading={statsLoading}
          sub={
            stats
              ? `${Math.round(stats.checklistCompletionRate)}% completion rate`
              : undefined
          }
        />
        <StatCard
          label="Avg. Compliance Score"
          value={stats ? `${Math.round(stats.averageComplianceScore)}%` : "—"}
          icon={<BarChart2 className="h-4 w-4" />}
          loading={statsLoading}
          valueColor={stats ? getScoreColor(stats.averageComplianceScore) : undefined}
          sub={
            stats?.averageComplianceScore !== undefined
              ? stats.averageComplianceScore >= 70
                ? "Good standing"
                : "Needs attention"
              : undefined
          }
        />
        <StatCard
          label="Checklist Completion"
          value={stats ? `${Math.round(stats.checklistCompletionRate)}%` : "—"}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={statsLoading}
          sub="of checklists applied to documents"
        />
      </div>

      {/* ── Charts Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ComplianceDistributionChart data={distribution} loading={statsLoading} />
        <StatusBreakdown stats={stats} loading={statsLoading} />
      </div>

      {/* ── Activity + Quick Actions Row ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityFeed items={activity} loading={activityLoading} />
        </div>
        <div>
          <QuickActions
            canUpload={canUpload}
            canEdit={canEdit}
            onUploadClick={() => setShowUpload(true)}
          />
        </div>
      </div>

      {/* Upload modal */}
      <UploadDocumentModal
        open={showUpload}
        onOpenChange={setShowUpload}
        onUploadComplete={() => {
          toast.success("Document uploaded successfully")
          fetchAll()
        }}
      />

      {/* First-time onboarding */}
      <OnboardingModal />
    </div>
  )
}
