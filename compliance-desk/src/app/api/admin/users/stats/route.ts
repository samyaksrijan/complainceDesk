import { prisma } from "@/lib/prisma"
import { SessionUser, withAdmin } from "@/lib/rbac"
import { NextResponse } from "next/server"

// GET /api/admin/users/stats
export const GET = withAdmin(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const users = await prisma.user.findMany({
        where: { orgId: user.orgId, status: { not: "DELETED" } },
        select: { role: true, status: true },
      })

      const stats = {
        total: users.length,
        byRole: {
          admin: users.filter((u) => u.role === "ADMIN").length,
          auditor: users.filter((u) => u.role === "AUDITOR").length,
          viewer: users.filter((u) => u.role === "VIEWER").length,
        },
        active: users.filter((u) => u.status === "ACTIVE").length,
        inactive: users.filter((u) => u.status === "INACTIVE").length,
      }

      return NextResponse.json(stats)
    } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("User stats error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
