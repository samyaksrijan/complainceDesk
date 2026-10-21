import { prisma } from "@/lib/prisma";
import { SessionUser, withAuth } from "@/lib/rbac";
import { NextResponse } from "next/server";

// DELETE /api/notifications/[id]
export const DELETE = withAuth(
  async (
    req: Request,
    { user, params }: { user: SessionUser; params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params

      const notification = await prisma.notification.findFirst({
        where: { id, userId: user.id },
      })

      if (!notification) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }

      await prisma.notification.delete({ where: { id } })

      return new NextResponse(null, { status: 204 })
    } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("Delete notification error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
)
