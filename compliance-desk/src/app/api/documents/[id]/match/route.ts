import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"
import { matchDocumentToChecklist } from "@/services/matching"
import { logActivity } from "@/services/activity"

// POST /api/documents/[id]/match
// Match a document to a checklist (auto or manual)
export async function POST(
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

    if (user.role === "VIEWER") {
      return NextResponse.json(
        { error: "You do not have permission to match documents", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    // Fetch document
    const document = await prisma.document.findFirst({
      where: { id, orgId: user.orgId },
    })

    if (!document) {
      return NextResponse.json(
        { error: "Document not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    if (!document.extractedText) {
      return NextResponse.json(
        { error: "Document has no extracted text", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    // Check if manual checklist ID provided
    const body = await req.json().catch(() => ({}))
    const manualChecklistId = body?.checklistId

    let matchResult

    if (manualChecklistId) {
      // Manual match
      const checklist = await prisma.checklist.findFirst({
        where: {
          id: manualChecklistId,
          OR: [
            { orgId: user.orgId },
            { isTemplate: true },
          ],
        },
      })

      if (!checklist) {
        return NextResponse.json(
          { error: "Checklist not found", code: "NOT_FOUND" },
          { status: 404 }
        )
      }

      matchResult = {
        matched: true,
        checklistId: checklist.id,
        checklistName: checklist.name,
        confidence: 1.0,
        matchType: "manual" as const,
        suggestions: [],
      }
    } else {
      // Auto-match
      matchResult = await matchDocumentToChecklist(
        document.extractedText,
        user.orgId
      )
    }

    if (matchResult.matched && matchResult.checklistId) {
      // Update document
      await prisma.document.update({
        where: { id },
        data: {
          matchedChecklistId: matchResult.checklistId,
          status: "MATCHED",
        },
      })

      // Fix 23: Use logActivity service
      logActivity({
        orgId: user.orgId,
        userId: user.id,
        action: "document.matched",
        resourceType: "document",
        resourceId: id,
        metadata: {
          checklistId: matchResult.checklistId,
          checklistName: matchResult.checklistName,
          matchType: matchResult.matchType,
          confidence: matchResult.confidence,
        },
      })
    }

    return NextResponse.json(matchResult)
  } catch (error: any) {
    console.error("Match error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
