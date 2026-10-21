import { prisma } from "@/lib/prisma"
import { SessionUser, withAuth } from "@/lib/rbac"
import { NextResponse } from "next/server"

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
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("Mark all read error:", error)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  }
)
