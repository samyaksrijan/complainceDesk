import { prisma } from "@/lib/prisma"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { SessionUser } from "@/lib/rbac"
import { extractDocumentValues } from "@/services/llm"
import { NextResponse } from "next/server"

// POST /api/scan/extract-values
// Extract actual values from an audit document for given checklist fields.
// Input: { documentId, checklistId }
// Output: { extractions: [...values with source excerpts] }
// NOTE: Does NOT create compliance results. That is Phase B5.
export async function POST(req: Request) {
  try {
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
        { error: "You do not have permission to extract values", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    // Fix 7: Rate limit LLM-consuming endpoints
    const rateLimit = await checkRateLimit(`extract:${user.id}`, RATE_LIMITS.LLM_SCAN)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { documentId, checklistId } = body

    if (!documentId || !checklistId) {
      return NextResponse.json(
        { error: "Both documentId and checklistId are required", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    // Fetch document
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        orgId: user.orgId,
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: "Document not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    if (!document.extractedText) {
      return NextResponse.json(
        { error: "Document has no extracted text. Re-upload the document.", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    if (document.extractedText.length > 240000) return NextResponse.json({ error: "Split documents above 240,000 extracted characters before extraction." }, { status: 413 })

    // Fetch checklist with items
    const checklist = await prisma.checklist.findFirst({
      where: {
        id: checklistId,
        OR: [
          { orgId: user.orgId },
          { isSystemTemplate: true },
        ],
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
      },
    })

    if (!checklist) {
      return NextResponse.json(
        { error: "Checklist not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    if (checklist.items.length === 0) {
      return NextResponse.json(
        { error: "Checklist has no items", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    // Build field list for extraction
    const fields = checklist.items.map((item) => ({
      fieldName: item.fieldName,
      fieldType: item.fieldType,
      condition: item.condition,
      thresholdValue: item.thresholdValue,
      unit: item.unit,
    }))

    // Call LLM
    const result = await extractDocumentValues(document.extractedText, fields)

    return NextResponse.json({
      extractions: result.extractions,
      meta: {
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        documentName: document.name,
        checklistName: checklist.name,
        fieldsRequested: fields.length,
        valuesFound: result.extractions.filter((e) => e.found).length,
      },
    })
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught))
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Extract values error:", error)

    if (error.message?.includes("LLM providers failed")) {
      return NextResponse.json(
        { error: "AI service unavailable. Please try again later.", code: "LLM_UNAVAILABLE" },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
