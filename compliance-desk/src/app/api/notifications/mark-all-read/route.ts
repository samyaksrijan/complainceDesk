import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth, SessionUser } from "@/lib/rbac"

// PUT /api/notifications/mark-all-read
export const PUT = withAuth(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const { count } = await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      })
      return NextResponse.json({ marked: count })
    } catch (error) {
      console.error("Mark all read error:", error)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  }
)
