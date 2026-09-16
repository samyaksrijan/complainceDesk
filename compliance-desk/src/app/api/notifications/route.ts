import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth, SessionUser } from "@/lib/rbac"
import { z } from "zod"

const createSchema = z.object({
  type: z.enum([
    "ANALYSIS_COMPLETE", "ANALYSIS_FAILED", "DOCUMENT_UPLOADED",
    "DOCUMENT_DELETED", "CHECKLIST_CREATED", "CHECKLIST_UPDATED",
    "ROLE_CHANGED", "USER_INVITED", "WEEKLY_DIGEST", "SYSTEM",
  ]),
  title: z.string().min(1),
  message: z.string().min(1),
  userId: z.string(),
  actorId: z.string().optional(),
  actorName: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  targetName: z.string().optional(),
})

// GET /api/notifications
export const GET = withAuth(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const url = new URL(req.url)
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1)
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20") || 20))
      const skip = (page - 1) * limit
      const unreadOnly = url.searchParams.get("unreadOnly") === "true"
      const type = url.searchParams.get("type") || ""
      const readStatus = url.searchParams.get("readStatus") || ""
      const search = url.searchParams.get("search") || ""

      const where: any = { userId: user.id }

      if (unreadOnly || readStatus === "UNREAD") where.read = false
      else if (readStatus === "READ") where.read = true

      if (type) where.type = type

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
        ]
      }

      const [items, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId: user.id, read: false } }),
      ])

      return NextResponse.json({
        items,
        total,
        unreadCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    } catch (error) {
      console.error("Get notifications error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)

// POST /api/notifications (internal - create a notification, no RBAC needed from services)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { userId, ...data } = parsed.data

    // Get user's orgId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const notification = await prisma.notification.create({
      data: {
        ...data,
        userId,
        orgId: user.orgId,
      },
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    console.error("Create notification error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
