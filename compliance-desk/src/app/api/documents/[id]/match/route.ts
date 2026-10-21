import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"
import { logActivity } from "@/services/activity"
import { matchDocumentToChecklist } from "@/services/matching"
import { NextResponse } from "next/server"

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

    if (document.status === "PROCESSING") return NextResponse.json({ error: "Wait for the current operation to complete." }, { status: 409 })

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
            { isSystemTemplate: true },
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
      const updated = await prisma.document.updateMany({
        where: { id, orgId: user.orgId, status: { not: "PROCESSING" } },
        data: {
          matchedChecklistId: matchResult.checklistId,
          status: "MATCHED",
        },
      })

      if (updated.count !== 1) return NextResponse.json({ error: "The document is being evaluated. Refresh and try again." }, { status: 409 })

      // Fix 23: Use logActivity service
      await logActivity({
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
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught))
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Match error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
