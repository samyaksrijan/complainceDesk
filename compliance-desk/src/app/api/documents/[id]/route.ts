import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"
import { deleteFile } from "@/services/storage"
import { logActivity } from "@/services/activity"

// GET /api/documents/[id] — Get document detail
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
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
                checklistItem: { select: { fieldName: true } },
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

    return NextResponse.json(document)
  } catch (error) {
    console.error("Get document error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}

// DELETE /api/documents/[id] — Delete document
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
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

    // Delete file from disk
    deleteFile(document.fileUrl)

    // Delete from database (cascade: results, result items)
    await prisma.document.delete({
      where: { id: id },
    })

    // Fix 23: Use logActivity service
    logActivity({
      orgId: user.orgId,
      userId: user.id,
      action: "document.deleted",
      resourceType: "document",
      resourceId: id,
      metadata: { name: document.name },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Delete document error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
