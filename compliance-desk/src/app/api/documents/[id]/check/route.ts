import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"
import { runComplianceCheck } from "@/services/compliance"
import { logActivity } from "@/services/activity"
import { checkRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit"

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
    const ip = getClientIp(req)
    const rateLimit = checkRateLimit(`check:${ip}`, RATE_LIMITS.LLM_SCAN)
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

    // Update status to PROCESSING
    await prisma.document.update({
      where: { id },
      data: { status: "PROCESSING" },
    })

    try {
      // Run compliance check
      const result = await runComplianceCheck(
        id,
        document.matchedChecklistId
      )

      // Fix 23: Use logActivity service
      logActivity({
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
    } catch (checkError: any) {
      // Revert status on failure
      await prisma.document.update({
        where: { id },
        data: { status: "MATCHED" },
      })
      throw checkError
    }
  } catch (error: any) {
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
