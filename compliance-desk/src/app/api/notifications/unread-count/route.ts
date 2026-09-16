import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth, SessionUser } from "@/lib/rbac"

// GET /api/notifications/unread-count
export const GET = withAuth(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const count = await prisma.notification.count({
        where: { userId: user.id, read: false },
      })
      return NextResponse.json({ count })
    } catch (error) {
      console.error("Unread count error:", error)
      return NextResponse.json({ count: 0 })
    }
  }
)
