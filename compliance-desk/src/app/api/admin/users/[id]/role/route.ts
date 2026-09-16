import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin, SessionUser } from "@/lib/rbac"
import { logActivity } from "@/services/activity"
import { z } from "zod"

const roleSchema = z.object({
  role: z.enum(["ADMIN", "AUDITOR", "VIEWER"]),
})

// PUT /api/admin/users/[id]/role — Change a user's role
export const PUT = withAdmin(
  async (req: Request, { user, params }: { user: SessionUser; params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params

      const body = await req.json()
      const parsed = roleSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid role. Must be ADMIN, AUDITOR, or VIEWER", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }

      // Find target user
      const targetUser = await prisma.user.findFirst({
        where: { id: id, orgId: user.orgId, status: { not: "DELETED" } },
      })

      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found", code: "NOT_FOUND" },
          { status: 404 }
        )
      }

      // Cannot change your own role
      if (id === user.id) {
        return NextResponse.json(
          { error: "Cannot change your own role", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }

      const oldRole = targetUser.role
      const newRole = parsed.data.role

      // Check for last admin
      if (oldRole === "ADMIN" && newRole !== "ADMIN") {
        const adminCount = await prisma.user.count({
          where: { orgId: user.orgId, role: "ADMIN", status: "ACTIVE" },
        })
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: "Cannot demote the last administrator. Promote another user to Admin first.", code: "VALIDATION_ERROR" },
            { status: 400 }
          )
        }
      }

      // Update role
      const updated = await prisma.user.update({
        where: { id: id },
        data: { role: newRole },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      })

      // Log activity
      await logActivity({
        orgId: user.orgId,
        userId: user.id,
        action: "user_role_changed",
        resourceType: "user",
        resourceId: id,
        metadata: {
          email: targetUser.email,
          oldRole,
          newRole,
        },
      })

      return NextResponse.json({
        user: updated,
        message: `Role changed from ${oldRole} to ${newRole}`,
      })
    } catch (error) {
      console.error("Change role error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
