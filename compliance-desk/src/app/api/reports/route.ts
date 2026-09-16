import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth, SessionUser } from "@/lib/rbac"

export const GET = withAuth(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const url = new URL(req.url)
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1)
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20") || 20))
      const skip = (page - 1) * limit

      const where = { orgId: user.orgId }

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          include: {
            generatedBy: { select: { id: true, name: true } },
            checklist: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
        }),
        prisma.report.count({ where }),
      ])

      const items = reports.map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
        generatedBy: r.generatedBy,
        documentCount: r.documentCount,
        averageScore: r.averageScore,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() || null,
        checklistName: r.checklist?.name || null,
      }))

      return NextResponse.json({
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    } catch (error) {
      console.error("Get reports error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
