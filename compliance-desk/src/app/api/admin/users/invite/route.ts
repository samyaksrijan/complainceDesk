import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin, SessionUser } from "@/lib/rbac"
import { logActivity } from "@/services/activity"
import bcrypt from "bcryptjs"
import { z } from "zod"

const inviteSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["ADMIN", "AUDITOR", "VIEWER"]),
})

// POST /api/admin/users/invite — Create a new user in the org
export const POST = withAdmin(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const body = await req.json()
      const parsed = inviteSchema.safeParse(body)

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

      const { email, name, role } = parsed.data

      // Check if email already exists
      const existing = await prisma.user.findUnique({
        where: { email },
      })

      if (existing) {
        return NextResponse.json(
          { error: "A user with this email already exists", code: "CONFLICT" },
          { status: 409 }
        )
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + "A1!"
      const passwordHash = await bcrypt.hash(tempPassword, 10)

      const newUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role,
          orgId: user.orgId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      })

      // Log activity
      await logActivity({
        orgId: user.orgId,
        userId: user.id,
        action: "user.invited",
        resourceType: "user",
        resourceId: newUser.id,
        metadata: { email, name, role },
      })

      return NextResponse.json(
        {
          user: newUser,
          tempPassword,
          message: "User created. Share the temporary password securely.",
        },
        { status: 201 }
      )
    } catch (error) {
      console.error("Invite user error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
