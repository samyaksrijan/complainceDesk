import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"

// GET /api/documents/[id]/results
// Get the latest compliance result for a document
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify document belongs to org
    const document = await prisma.document.findFirst({
      where: { id, orgId: user.orgId },
    })

    if (!document) {
      return NextResponse.json(
        { error: "Document not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    // Get latest result
    const result = await prisma.complianceResult.findFirst({
      where: { documentId: id },
      include: {
        checklist: { select: { id: true, name: true, category: true } },
        items: {
          include: {
            checklistItem: {
              select: {
                fieldName: true,
                fieldType: true,
                condition: true,
                thresholdValue: true,
                unit: true,
                regulationRef: true,
              },
            },
          },
          orderBy: { checklistItem: { sortOrder: "asc" } },
        },
      },
      orderBy: { generatedAt: "desc" },
    })

    if (!result) {
      return NextResponse.json(
        { error: "No compliance results found for this document. Run a check first.", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Get results error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
