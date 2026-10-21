import { prisma } from "@/lib/prisma"
import { SessionUser, withAuth } from "@/lib/rbac"
import { NotificationType, Prisma, Role } from "@prisma/client"
import { NextResponse } from "next/server"
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

      const where: Prisma.NotificationWhereInput = { userId: user.id }

      if (unreadOnly || readStatus === "UNREAD") where.read = false
      else if (readStatus === "READ") where.read = true

      if (type && Object.values(NotificationType).includes(type as NotificationType)) where.type = type as NotificationType

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
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("Get notifications error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)

// POST /api/notifications (internal - create a notification, no RBAC needed from services)
export const POST = withAuth(async (req: Request, { user: actor }) => {
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
      where: { id: userId, orgId: actor.orgId },
      select: { orgId: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const notification = await prisma.notification.create({
      data: {
        ...data,
        actorId: actor.id,
        actorName: actor.name,
        userId,
        orgId: user.orgId,
      },
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Create notification error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}, [Role.ADMIN])
