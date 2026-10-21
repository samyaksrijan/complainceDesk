import { prisma } from "@/lib/prisma"
import { withAnyRole } from "@/lib/rbac"
import { getRecentActivity } from "@/services/activity"
import { NextResponse } from "next/server"

export const GET = withAnyRole(async (_req, { user }) => {
  const orgId = user.orgId
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const [totalDocuments, totalChecklists, counts, scores, recent, thisMonth, lastMonth, logs] = await Promise.all([
    prisma.document.count({ where: { orgId } }),
    prisma.checklist.count({ where: { orgId, isTemplate: false } }),
    prisma.document.groupBy({ by: ["status"], where: { orgId }, _count: { id: true } }),
    prisma.$queryRaw<Array<{ overallScore: number; category: string | null }>>`
      SELECT latest."overallScore", c.category FROM (
        SELECT DISTINCT ON (r."documentId") r."overallScore", r."checklistId", r."documentId"
        FROM "ComplianceResult" r JOIN "Document" d ON d.id = r."documentId"
        WHERE d."orgId" = ${orgId} ORDER BY r."documentId", r."generatedAt" DESC, r.id DESC
      ) latest JOIN "Checklist" c ON c.id = latest."checklistId"`,
    prisma.document.findMany({ where: { orgId }, include: { results: { orderBy: { generatedAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.document.count({ where: { orgId, createdAt: { gte: start } } }),
    prisma.document.count({ where: { orgId, createdAt: { gte: previous, lt: start } } }),
    getRecentActivity(orgId, 8),
  ])
  const status = Object.fromEntries(counts.map(c => [c.status, c._count.id]))
  const compliant = status.COMPLIANT || 0
  const nonCompliant = status.NON_COMPLIANT || 0
  const processing = status.PROCESSING || 0
  const pending = totalDocuments - compliant - nonCompliant - processing
  const averageComplianceScore = scores.length ? Math.round(scores.reduce((n, s) => n + s.overallScore, 0) / scores.length * 10) / 10 : 0
  const complianceRate = compliant + nonCompliant ? Math.round(compliant / (compliant + nonCompliant) * 1000) / 10 : 0
  const groups = new Map<string, number[]>()
  for (const score of scores) { const key = score.category || "Uncategorized"; groups.set(key, [...(groups.get(key) || []), score.overallScore]) }
  return NextResponse.json({
    totalDocuments, complianceRate, activeChecklists: totalChecklists, pendingReviews: pending + processing,
    breakdown: { compliant, nonCompliant, pending: pending + processing },
    byCategory: [...groups].map(([category, values]) => ({ category, avgScore: values.reduce((a,b) => a+b, 0) / values.length, docCount: values.length })),
    recentDocuments: recent.map(d => ({ id: d.id, name: d.name, status: d.status, latestScore: d.results[0]?.overallScore ?? null, createdAt: d.createdAt })),
    stats: { totalDocuments, totalChecklists, averageComplianceScore, documentsByStatus: { compliant, nonCompliant, pending, processing, error: 0 }, documentsThisMonth: thisMonth, documentsLastMonth: lastMonth, checklistCompletionRate: totalDocuments ? Math.round((compliant + nonCompliant) / totalDocuments * 1000) / 10 : 0 },
    distribution: [{ range: "0-25", count: scores.filter(s => s.overallScore <= 25).length }, { range: "26-50", count: scores.filter(s => s.overallScore > 25 && s.overallScore <= 50).length }, { range: "51-75", count: scores.filter(s => s.overallScore > 50 && s.overallScore <= 75).length }, { range: "76-100", count: scores.filter(s => s.overallScore > 75).length }],
    activity: logs.map(log => ({ id: log.id, type: log.action === "document.checked" ? "ANALYSIS_COMPLETED" : log.action === "checklist.created" ? "CHECKLIST_CREATED" : log.action === "document.deleted" ? "DOCUMENT_DELETED" : log.action === "document.uploaded" ? "DOCUMENT_UPLOADED" : "SYSTEM_EVENT", description: `${log.action.replaceAll(".", " ").replaceAll("_", " ")}${log.resourceName ? ': ' + log.resourceName : ''}`, userName: log.user?.name || "Former member", userRole: log.user?.role || "", timestamp: log.createdAt, ...(log.resourceType === "document" ? { documentId: log.resourceId } : {}) })),
  })
})
