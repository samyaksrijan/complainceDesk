import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin, SessionUser } from "@/lib/rbac"
import { logActivity } from "@/services/activity"

// DELETE /api/admin/users/[id] — Remove a user from the org
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { getServerSession } = await import("next-auth")
    const { authOptions } = await import("@/lib/auth")
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const user = session.user as SessionUser

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can remove users", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    // Cannot delete yourself
    if (id === user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    // Find the target user
    const targetUser = await prisma.user.findFirst({
      where: { id: id, orgId: user.orgId },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    // Soft-delete the user
    await prisma.user.update({
      where: { id: id },
      data: { status: "DELETED" },
    })

    // Log activity
    await logActivity({
      orgId: user.orgId,
      userId: user.id,
      action: "user.removed",
      resourceType: "user",
      resourceId: id,
      metadata: { removedEmail: targetUser.email, removedName: targetUser.name },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
