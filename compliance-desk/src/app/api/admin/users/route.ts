import { prisma } from "@/lib/prisma"
import { SessionUser, withAdmin } from "@/lib/rbac"
import { registerSchema } from "@/lib/validation"
import { logActivity } from "@/services/activity"
import { Prisma, Role, UserStatus } from "@prisma/client"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

// GET /api/admin/users
export const GET = withAdmin(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const url = new URL(req.url)
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1)
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25") || 25))
      const skip = (page - 1) * limit
      const search = url.searchParams.get("search") || ""
      const role = url.searchParams.get("role") || ""
      const status = url.searchParams.get("status") || ""

      const where: Prisma.UserWhereInput = { orgId: user.orgId, status: { not: "DELETED" } }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ]
      }
      if (role && Object.values(Role).includes(role as Role)) where.role = role as Role
      if (status && Object.values(UserStatus).includes(status as UserStatus)) where.status = status as UserStatus

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
            _count: {
              select: {
                documents: true,
                checklists: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
        }),
        prisma.user.count({ where }),
      ])

      return NextResponse.json({
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
          documentCount: u._count.documents,
          checklistCount: u._count.checklists,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("List users error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email format").transform(v => v.toLowerCase().trim()),
  role: z.enum(["ADMIN", "AUDITOR", "VIEWER"]),
  temporaryPassword: registerSchema.shape.password,
})

// POST /api/admin/users
export const POST = withAdmin(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const body = await req.json()
      const parsed = createUserSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        )
      }

      const { name, email, role, temporaryPassword } = parsed.data

      // Check for existing user
      const existing = await prisma.user.findUnique({
        where: { email },
      })

      if (existing) {
        // If they exist but are DELETED, we could potentially reactivate them, but for simplicity we'll just say email is in use.
        return NextResponse.json(
          { error: "Email is already in use", code: "CONFLICT" },
          { status: 409 }
        )
      }

      const passwordHash = await bcrypt.hash(temporaryPassword, 12)

      const newUser = await prisma.user.create({
        data: {
          email,
          name,
          role,
          passwordHash,
          orgId: user.orgId,
          status: "ACTIVE",
        },
      })

      await logActivity({
        orgId: user.orgId,
        userId: user.id,
        action: "user_created",
        resourceType: "user",
        resourceId: newUser.id,
        metadata: { createdEmail: email, assignedRole: role },
      })

      return NextResponse.json({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      }, { status: 201 })
    } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("Create user error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)

