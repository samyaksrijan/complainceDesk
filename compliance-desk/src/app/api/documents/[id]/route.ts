import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"
import { logActivity } from "@/services/activity"
import { formatThreshold } from "@/services/compliance"
import { deleteFile } from "@/services/storage"
import { NextResponse } from "next/server"

// GET /api/documents/[id] — Get document detail
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const document = await prisma.document.findFirst({
      where: {
        id: id,
        orgId: user.orgId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        matchedChecklist: {
          select: { id: true, name: true, category: true },
        },
        results: {
          include: {
            items: {
              include: {
                checklistItem: true,
              },
            },
          },
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: "Document not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    return NextResponse.json({ ...document, results: document.results.map(result => ({ ...result, items: result.items.map(item => ({ ...item, fieldName: item.checklistItem.fieldName, expected: formatThreshold(item.checklistItem.condition, item.checklistItem.thresholdValue, item.checklistItem.unit) })) })) })
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Get document error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}

// DELETE /api/documents/[id] — Delete document
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
        { error: "Only admins can delete documents", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    const document = await prisma.document.findFirst({
      where: {
        id: id,
        orgId: user.orgId,
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: "Document not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    if (document.status === "PROCESSING") return NextResponse.json({ error: "Wait for evaluation to complete before deletion." }, { status: 409 })

    // Delete file from disk
    await deleteFile(document.fileUrl)

    // Delete from database (cascade: results, result items)
    await prisma.document.delete({
      where: { id: id },
    })

    // Fix 23: Use logActivity service
    await logActivity({
      orgId: user.orgId,
      userId: user.id,
      action: "document.deleted",
      resourceType: "document",
      resourceId: id,
      metadata: { name: document.name },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Delete document error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
