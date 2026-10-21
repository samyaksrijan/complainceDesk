import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/services/activity"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  email: z.string().email("Invalid email format").transform(v => v.toLowerCase().trim()).optional(),
  emailNotifications: z.boolean().optional(),
  analysisCompleteNotifications: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
})

// GET /api/users/me — Current user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        emailNotifications: true,
        analysisCompleteNotifications: true,
        weeklyDigest: true,
        // Notification preferences — stored in metadata JSON or as columns
        // Fall back gracefully if they don't exist
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      // Notification prefs default to true if not stored
      emailNotifications: user.emailNotifications,
      analysisCompleteNotifications: user.analysisCompleteNotifications,
      weeklyDigest: user.weeklyDigest,
    })
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("GET /api/users/me error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}

// PUT /api/users/me — Update name/email/notification preferences
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = updateProfileSchema.safeParse(body)

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

    const { name, email, emailNotifications, analysisCompleteNotifications, weeklyDigest } = parsed.data

    // Check email uniqueness if being changed
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: session.user.id } },
      })
      if (existing) {
        return NextResponse.json(
          { error: "Email already in use by another account", code: "CONFLICT" },
          { status: 409 }
        )
      }
    }

    const updateData: Partial<z.infer<typeof updateProfileSchema>> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications
    if (analysisCompleteNotifications !== undefined) updateData.analysisCompleteNotifications = analysisCompleteNotifications
    if (weeklyDigest !== undefined) updateData.weeklyDigest = weeklyDigest

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, createdAt: true, emailNotifications: true, analysisCompleteNotifications: true, weeklyDigest: true },
    })

    if (name || email) {
      await logActivity({
        orgId: session.user.orgId,
        userId: session.user.id,
        action: "profile_updated",
        resourceType: "user",
        resourceId: session.user.id,
        metadata: { updatedFields: Object.keys(updateData).join(", ") },
      })
    }

    return NextResponse.json({
      ...updatedUser,

    })
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("PUT /api/users/me error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
