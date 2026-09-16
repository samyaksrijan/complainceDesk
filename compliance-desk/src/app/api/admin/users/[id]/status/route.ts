import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin, SessionUser } from "@/lib/rbac"
import { logActivity } from "@/services/activity"
import { z } from "zod"

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
})

// PUT /api/admin/users/[id]/status — Change a user's status
export const PUT = withAdmin(
  async (req: Request, { user, params }: { user: SessionUser; params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params

      if (id === user.id) {
        return NextResponse.json(
          { error: "Cannot change your own status", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }

      const body = await req.json()
      const parsed = statusSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid status. Must be ACTIVE or INACTIVE", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }

      const newStatus = parsed.data.status

      const targetUser = await prisma.user.findFirst({
        where: { id: id, orgId: user.orgId, status: { not: "DELETED" } },
      })

      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found or deleted", code: "NOT_FOUND" },
          { status: 404 }
        )
      }

      // Check for last admin
      if (newStatus === "INACTIVE" && targetUser.role === "ADMIN") {
        const adminCount = await prisma.user.count({
          where: { orgId: user.orgId, role: "ADMIN", status: "ACTIVE" },
        })
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: "Cannot deactivate the last active administrator. Promote another user to Admin first.", code: "VALIDATION_ERROR" },
            { status: 400 }
          )
        }
      }

      const updated = await prisma.user.update({
        where: { id: id },
        data: { status: newStatus },
      })

      await logActivity({
        orgId: user.orgId,
        userId: user.id,
        action: newStatus === "INACTIVE" ? "user_deactivated" : "user_activated",
        resourceType: "user",
        resourceId: id,
        metadata: { email: targetUser.email },
      })

      return NextResponse.json({
        user: updated,
        message: `User status changed to ${newStatus}`,
      })
    } catch (error) {
      console.error("Change status error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
