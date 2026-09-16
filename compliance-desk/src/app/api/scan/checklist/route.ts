import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"
import { scanChecklistDocument } from "@/services/llm"
import { extractText, getFileType, isSupportedFileType } from "@/services/extraction"
import { saveFile, deleteFile } from "@/services/storage"
import { checkRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit"

// POST /api/scan/checklist
// Scan a compliance document and extract checklist fields.
// Input: multipart form (file) OR JSON body { text: string }
// Output: { items: [...extracted fields with confidence] }
// NOTE: Does NOT save to database. User reviews first.
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
        { error: "You do not have permission to scan documents", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    // Fix 7: Rate limit LLM-consuming endpoints
    const ip = getClientIp(req)
    const rateLimit = checkRateLimit(`scan:${ip}`, RATE_LIMITS.LLM_SCAN)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429 }
      )
    }

    const contentType = req.headers.get("content-type") || ""
    let documentText = ""

    if (contentType.includes("multipart/form-data")) {
      // File upload path
      const formData = await req.formData()
      const file = formData.get("file") as File | null

      if (!file) {
        return NextResponse.json(
          { error: "No file provided", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }

      const fileType = getFileType(file.name)
      if (!isSupportedFileType(fileType)) {
        return NextResponse.json(
          { error: `Unsupported file type: .${fileType}`, code: "UNSUPPORTED_TYPE" },
          { status: 415 }
        )
      }

      // Save file temporarily and extract text
      const arrayBuffer = await file.arrayBuffer()
      const fileBuffer = Buffer.from(arrayBuffer)
      const filePath = await saveFile(user.orgId, file.name, fileBuffer)

      const extraction = await extractText(filePath, fileType)

      if (extraction.error) {
        return NextResponse.json(
          { error: `Text extraction failed: ${extraction.error}`, code: "EXTRACTION_ERROR" },
          { status: 422 }
        )
      }

      documentText = extraction.text

      // Fix 11: Clean up temporary scan file (not persisted in DB)
      try {
        deleteFile(filePath)
      } catch {
        // Ignore cleanup errors
      }
    } else {
      // JSON body path (raw text)
      const body = await req.json()
      documentText = body.text

      if (!documentText || typeof documentText !== "string") {
        return NextResponse.json(
          { error: "No text provided. Send { text: '...' } or upload a file.", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }
    }

    // Validate text length
    if (documentText.trim().length < 50) {
      return NextResponse.json(
        { error: "Document text is too short to scan (minimum 50 characters)", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    // Call LLM to scan document
    const result = await scanChecklistDocument(documentText)

    return NextResponse.json({
      items: result.items,
      meta: {
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        textLength: documentText.length,
        itemsFound: result.items.length,
      },
    })
  } catch (error: any) {
    console.error("Scan checklist error:", error)

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
