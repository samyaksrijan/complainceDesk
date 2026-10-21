import { prisma } from "@/lib/prisma"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { SessionUser } from "@/lib/rbac"
import { logActivity } from "@/services/activity"
import { runComplianceCheck } from "@/services/compliance"
import { NextResponse } from "next/server"

// POST /api/documents/[id]/check
// Run compliance check on a document against its matched checklist
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
        { error: "You do not have permission to run compliance checks", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    // Fix 7: Rate limit LLM-consuming endpoints
    const rateLimit = await checkRateLimit(`check:${user.id}`, RATE_LIMITS.LLM_SCAN)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429 }
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

    if (!document.matchedChecklistId) {
      return NextResponse.json(
        {
          error: "Document has no matched checklist. Match it first using POST /api/documents/{id}/match",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      )
    }

    if (!document.extractedText) return NextResponse.json({ error: "Document has no extracted text. Re-upload it before evaluation." }, { status: 422 })
    if (document.extractedText.length > 240000) return NextResponse.json({ error: "Split documents above 240,000 extracted characters before evaluation." }, { status: 413 })
    const lease = new Date()
    const claim = await prisma.document.updateMany({
      where: { id, orgId: user.orgId, OR: [{ status: { not: "PROCESSING" } }, { status: "PROCESSING", processingStartedAt: null }, { processingStartedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }] },
      data: { status: "PROCESSING", processingStartedAt: lease },
    })
    if (claim.count !== 1) return NextResponse.json({ error: "This document is already being evaluated. Please refresh shortly." }, { status: 409 })

    try {
      // Run compliance check
      const result = await runComplianceCheck(
        id,
        document.matchedChecklistId,
        lease
      )

      // Fix 23: Use logActivity service
      await logActivity({
        orgId: user.orgId,
        userId: user.id,
        action: "document.checked",
        resourceType: "document",
        resourceId: id,
        metadata: {
          score: result.overallScore,
          passed: result.passedItems,
          failed: result.failedItems,
          total: result.totalItems,
        },
      })

      return NextResponse.json(result)
    } catch (caught) {
    const checkError = caught instanceof Error ? caught : new Error(String(caught))
      // Revert status on failure
      await prisma.document.updateMany({
        where: { id, processingStartedAt: lease },
        data: { status: "MATCHED", processingStartedAt: null },
      })
      throw checkError
    }
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught))
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Compliance check error:", error)

    if (error.message?.includes("LLM providers failed")) {
      return NextResponse.json(
        { error: "AI service unavailable. Please try again later.", code: "LLM_UNAVAILABLE" },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
