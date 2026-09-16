import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAnyRole, SessionUser } from "@/lib/rbac"

// GET /api/audit-log
// Query: page, limit, action, search, startDate, endDate
export const GET = withAnyRole(
  async (req: Request, { user }: { user: SessionUser }) => {
    // Viewers are not permitted to access the audit log
    if (user.role === "VIEWER") {
      return NextResponse.json(
        { error: "Insufficient permissions", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    try {
      const url = new URL(req.url)
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1)
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25") || 25))
      const skip = (page - 1) * limit
      const action = url.searchParams.get("action") || ""
      const search = url.searchParams.get("search") || ""
      const startDate = url.searchParams.get("startDate") || ""
      const endDate = url.searchParams.get("endDate") || ""

      // Build WHERE clause
      const where: any = { orgId: user.orgId }

      if (action) {
        where.action = action
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = new Date(startDate)
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          where.createdAt.lte = end
        }
      }

      if (search) {
        where.OR = [
          { action: { contains: search, mode: "insensitive" } },
          { resourceType: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
        ]
      }

      const [items, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
        }),
        prisma.activityLog.count({ where }),
      ])

      // Enrich with resource names (batch fetch)
      const documentIds = new Set<string>()
      const checklistIds = new Set<string>()
      for (const item of items) {
        if (item.resourceId) {
          if (item.resourceType === "document") documentIds.add(item.resourceId)
          else if (item.resourceType === "checklist") checklistIds.add(item.resourceId)
        }
      }

      const [documents, checklists] = await Promise.all([
        documentIds.size > 0
          ? prisma.document.findMany({
              where: { id: { in: Array.from(documentIds) } },
              select: { id: true, name: true },
            })
          : [],
        checklistIds.size > 0
          ? prisma.checklist.findMany({
              where: { id: { in: Array.from(checklistIds) } },
              select: { id: true, name: true },
            })
          : [],
      ])

      const docMap = new Map(documents.map((d) => [d.id, d.name]))
      const checkMap = new Map(checklists.map((c) => [c.id, c.name]))

      const enriched = items.map((item) => {
        const resourceName =
          item.resourceType === "document"
            ? (docMap.get(item.resourceId ?? "") ?? null)
            : item.resourceType === "checklist"
            ? (checkMap.get(item.resourceId ?? "") ?? null)
            : null

        return {
          id: item.id,
          action: item.action,
          resourceType: item.resourceType,
          resourceId: item.resourceId,
          resourceName,
          metadata: item.metadata,
          user: item.user,
          createdAt: item.createdAt,
        }
      })

      return NextResponse.json({
        items: enriched,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    } catch (error) {
      console.error("Audit log error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
