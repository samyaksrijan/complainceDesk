import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAnyRole, SessionUser } from "@/lib/rbac"

// GET /api/dashboard/stats
export const GET = withAnyRole(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const orgId = user.orgId

      // Run all queries in parallel for speed
      const [
        totalDocuments,
        totalChecklists,
        statusCounts,
        categoryScores,
        recentDocuments,
      ] = await Promise.all([
        // Total documents
        prisma.document.count({
          where: { orgId },
        }),

        // Total active (non-template) checklists
        prisma.checklist.count({
          where: { orgId, isTemplate: false },
        }),

        // Document status breakdown
        prisma.document.groupBy({
          by: ["status"],
          where: { orgId },
          _count: { id: true },
        }),

        // Average score by checklist category
        prisma.$queryRaw`
          SELECT
            c.category,
            ROUND(AVG(cr."overallScore")::numeric, 1) as "avgScore",
            COUNT(DISTINCT cr."documentId")::int as "docCount"
          FROM "ComplianceResult" cr
          JOIN "Checklist" c ON c.id = cr."checklistId"
          JOIN "Document" d ON d.id = cr."documentId"
          WHERE d."orgId" = ${orgId}
          GROUP BY c.category
        `,

        // Recent documents with latest score
        prisma.document.findMany({
          where: { orgId },
          include: {
            results: {
              select: { overallScore: true },
              orderBy: { generatedAt: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ])

      // Process status counts
      const statusMap: Record<string, number> = {}
      for (const sc of statusCounts) {
        statusMap[sc.status] = sc._count.id
      }

      const compliant = statusMap["COMPLIANT"] || 0
      const nonCompliant = statusMap["NON_COMPLIANT"] || 0
      const pending =
        (statusMap["UPLOADED"] || 0) +
        (statusMap["PROCESSING"] || 0) +
        (statusMap["UNMATCHED"] || 0) +
        (statusMap["UNDER_REVIEW"] || 0) +
        (statusMap["MATCHED"] || 0)

      // Calculate compliance rate
      const checkedDocuments = compliant + nonCompliant
      const complianceRate = checkedDocuments > 0
        ? Math.round((compliant / checkedDocuments) * 1000) / 10
        : 0

      // Format category scores
      const byCategory = (categoryScores as any[]).map((row: any) => ({
        category: row.category || "uncategorized",
        avgScore: parseFloat(row.avgScore) || 0,
        docCount: row.docCount || 0,
      }))

      // Format recent documents
      const recent = recentDocuments.map((doc) => ({
        id: doc.id,
        name: doc.name,
        status: doc.status,
        latestScore: doc.results[0]?.overallScore || null,
        createdAt: doc.createdAt,
      }))

      return NextResponse.json({
        totalDocuments,
        complianceRate,
        activeChecklists: totalChecklists,
        pendingReviews: pending,
        breakdown: {
          compliant,
          nonCompliant,
          pending,
        },
        byCategory,
        recentDocuments: recent,
      })
    } catch (error) {
      console.error("Dashboard stats error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
