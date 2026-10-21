import { prisma } from "@/lib/prisma"
import { SessionUser, withAuth } from "@/lib/rbac"
import { NextResponse } from "next/server"

// GET /api/notifications/unread-count
export const GET = withAuth(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const count = await prisma.notification.count({
        where: { userId: user.id, read: false },
      })
      return NextResponse.json({ count })
    } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("Unread count error:", error)
      return NextResponse.json({ count: 0 })
    }
  }
)
