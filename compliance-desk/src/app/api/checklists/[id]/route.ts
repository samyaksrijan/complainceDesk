import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"
import { updateChecklistSchema } from "@/lib/validation"
import { logActivity } from "@/services/activity"
import { NextResponse } from "next/server"

// GET /api/checklists/[id] — Get single checklist with all items
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await (await import("@/lib/auth")).authOptions
    const { getServerSession } = await import("next-auth")
    const sessionData = await getServerSession(session)

    if (!sessionData?.user) {
      return NextResponse.json(
        { error: "Not authenticated", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const user = sessionData.user as SessionUser

    // Fix 24: Allow viewing templates from other orgs
    const checklist = await prisma.checklist.findFirst({
      where: {
        id: id,
        OR: [
          { orgId: user.orgId },
          { isSystemTemplate: true },
        ],
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!checklist) {
      return NextResponse.json(
        { error: "Checklist not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    return NextResponse.json(checklist)
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Get checklist error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}

// PUT /api/checklists/[id] — Update checklist metadata and/or replace items
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { getServerSession } = await import("next-auth")
    const { authOptions } = await import("@/lib/auth")
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const user = session.user as SessionUser

    // Only ADMIN and AUDITOR can update
    if (user.role === "VIEWER") {
      return NextResponse.json(
        { error: "You do not have permission to perform this action", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    // Verify checklist exists and belongs to org (NOT templates from other orgs)
    const existing = await prisma.checklist.findFirst({
      where: { id: id, orgId: user.orgId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const parsed = updateChecklistSchema.safeParse(body)

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

    const data = parsed.data
    if (data.items && await prisma.complianceResult.count({ where: { checklistId: id } })) {
      return NextResponse.json({ error: "This checklist has historical results. Clone it before changing criteria to preserve the audit trail.", code: "CONFLICT" }, { status: 409 })
    }

    // Update in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update metadata fields
      const updateData: import("@prisma/client").Prisma.ChecklistUpdateInput = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description
      if (data.category !== undefined) updateData.category = data.category
      if (data.tags !== undefined) updateData.tags = data.tags
      if (data.isTemplate !== undefined) updateData.isTemplate = data.isTemplate

      // If items provided, delete old items and insert new ones
      if (data.items) {
        await tx.checklistItem.deleteMany({
          where: { checklistId: id },
        })

        await tx.checklistItem.createMany({
          data: data.items.map((item) => ({
            checklistId: id,
            fieldName: item.fieldName,
            fieldType: item.fieldType,
            unit: item.unit || null,
            condition: item.condition,
            thresholdValue: item.thresholdValue,
            options: item.options || undefined,
            sourceText: item.sourceText || null,
            confidence: item.confidence ?? null,
            regulationRef: item.regulationRef || null,
            sortOrder: item.sortOrder,
          })),
        })
      }

      // Update the checklist metadata
      const checklist = await tx.checklist.update({
        where: { id: id },
        data: updateData,
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          createdBy: { select: { id: true, name: true } },
        },
      })

      return checklist
    })

    // Fix 23: Use logActivity service
    await logActivity({
      orgId: user.orgId,
      userId: user.id,
      action: "checklist.updated",
      resourceType: "checklist",
      resourceId: id,
      metadata: { name: updated.name },
    })

    return NextResponse.json(updated)
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Update checklist error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}

// DELETE /api/checklists/[id] — Delete checklist
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { getServerSession } = await import("next-auth")
    const { authOptions } = await import("@/lib/auth")
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const user = session.user as SessionUser

    // Only ADMIN can delete
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can delete checklists", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    // Verify checklist exists and belongs to org
    const existing = await prisma.checklist.findFirst({
      where: { id: id, orgId: user.orgId },
      include: {
        _count: { select: { matchResults: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Checklist not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    // Check if checklist is linked to any compliance results
    if (existing._count.matchResults > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete checklist that has been used in compliance checks. Delete the associated documents first.",
          code: "CONFLICT",
        },
        { status: 409 }
      )
    }

    await prisma.checklist.delete({
      where: { id: id },
    })

    // Fix 23: Use logActivity service
    await logActivity({
      orgId: user.orgId,
      userId: user.id,
      action: "checklist.deleted",
      resourceType: "checklist",
      resourceId: id,
      metadata: { name: existing.name },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Delete checklist error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
