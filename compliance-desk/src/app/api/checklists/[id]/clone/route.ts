import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuditorOrAdmin, SessionUser } from "@/lib/rbac"
import { logActivity } from "@/services/activity"

// POST /api/checklists/[id]/clone — Clone a checklist template
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
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

    // Only ADMIN and AUDITOR can clone
    if (user.role === "VIEWER") {
      return NextResponse.json(
        { error: "You do not have permission to perform this action", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    // Find the source checklist (can be from any org if it is a template,
    // or from the same org if it is a custom checklist)
    const source = await prisma.checklist.findFirst({
      where: {
        id: id,
        OR: [
          { orgId: user.orgId },
          { isTemplate: true },
        ],
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
      },
    })

    if (!source) {
      return NextResponse.json(
        { error: "Checklist not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    // Create clone with all items
    const cloned = await prisma.checklist.create({
      data: {
        name: `${source.name} (Copy)`,
        description: source.description,
        category: source.category,
        tags: source.tags,
        sourceType: source.sourceType,
        isTemplate: false, // cloned copies are never templates
        orgId: user.orgId,
        createdById: user.id,
        items: {
          create: source.items.map((item) => ({
            fieldName: item.fieldName,
            fieldType: item.fieldType,
            unit: item.unit,
            condition: item.condition,
            thresholdValue: item.thresholdValue,
            options: item.options,
            sourceText: item.sourceText,
            confidence: item.confidence,
            regulationRef: item.regulationRef,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    // Fix 23: Use logActivity service
    logActivity({
      orgId: user.orgId,
      userId: user.id,
      action: "checklist.cloned",
      resourceType: "checklist",
      resourceId: cloned.id,
      metadata: {
        name: cloned.name,
        sourceId: source.id,
        sourceName: source.name,
      },
    })

    return NextResponse.json(cloned, { status: 201 })
  } catch (error) {
    console.error("Clone checklist error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
