import { prisma } from "@/lib/prisma"
import { SessionUser, withAnyRole } from "@/lib/rbac"
import { getRecentActivity } from "@/services/activity"
import { NextResponse } from "next/server"

// GET /api/dashboard/activity
export const GET = withAnyRole(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const url = new URL(req.url)

      // TD-4: Proper pagination for activity feed
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1)
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20") || 20))
      const skip = (page - 1) * limit

      const [activities, total] = await Promise.all([
        getRecentActivity(user.orgId, limit, skip),
        prisma.activityLog.count({ where: { orgId: user.orgId } }),
      ])

      return NextResponse.json({
        activities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("Activity feed error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
