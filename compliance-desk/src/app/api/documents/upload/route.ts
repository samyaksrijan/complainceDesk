import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { boundedFormData, PayloadTooLarge } from "@/lib/request-body"
import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"
import { logActivity } from "@/services/activity"
import { extractText, getFileType, isSupportedFileType, isWithinSizeLimit } from "@/services/extraction"
import { deleteFile, saveFile } from "@/services/storage"
import { NextResponse } from "next/server"

// POST /api/documents/upload
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

    // Only ADMIN and AUDITOR can upload
    if (user.role === "VIEWER") {
      return NextResponse.json(
        { error: "You do not have permission to upload documents", code: "FORBIDDEN" },
        { status: 403 }
      )
    }

    const allowance = await checkRateLimit(`upload:${user.id}`, RATE_LIMITS.LLM_SCAN)
    if (!allowance.allowed) return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 })

    // Parse multipart form data
    const formData = await boundedFormData(req, (Number(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 + 1024 * 1024)
    const file = formData.get("file") as File | null
    const name = formData.get("name") as string | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Document name is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    // Fix 14: Document name max length
    if (name.trim().length > 255) {
      return NextResponse.json(
        { error: "Document name must be 255 characters or less", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    // Validate file type
    const fileType = getFileType(file.name)
    if (!isSupportedFileType(fileType)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: .${fileType}. Supported: pdf, docx, png, jpg, txt`,
          code: "UNSUPPORTED_TYPE",
        },
        { status: 415 }
      )
    }

    // Validate file size
    const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || "10")
    if (!isWithinSizeLimit(file.size, maxSizeMB)) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size: ${maxSizeMB}MB`,
          code: "FILE_TOO_LARGE",
        },
        { status: 413 }
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Save file to disk
    const filePath = await saveFile(user.orgId, file.name, fileBuffer)

    // Create document record (status: UPLOADED)
    const document = await prisma.document.create({
      data: {
        name: name.trim(),
        fileUrl: filePath,
        fileType: fileType,
        status: "UPLOADED",
        orgId: user.orgId,
        uploadedById: user.id,
      },
    }).catch(async (error) => { await deleteFile(filePath); throw error })

    // Trigger text extraction (synchronous for now)
    // Update status to PROCESSING first
    await prisma.document.update({
      where: { id: document.id },
      data: { status: "PROCESSING" },
    })

    const extraction = await extractText(filePath, fileType)

    if (extraction.error) {
      // Extraction failed but document is saved
      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: "UPLOADED",
          extractedText: null,
        },
      })

      return NextResponse.json(
        {
          ...document,
          status: "UPLOADED",
          extractedText: null,
          extractionError: extraction.error,
        },
        { status: 201 }
      )
    }

    // Update document with extracted text and set status to UNMATCHED
    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: {
        extractedText: extraction.text,
        status: "UNMATCHED",
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    })

    // Fix 23: Use logActivity service
    await logActivity({
      orgId: user.orgId,
      userId: user.id,
      action: "document.uploaded",
      resourceType: "document",
      resourceId: document.id,
      metadata: {
        name: updatedDocument.name,
        fileType: updatedDocument.fileType,
        textLength: extraction.text.length,
        method: extraction.method,
      },
    })

    return NextResponse.json(updatedDocument, { status: 201 })
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught))
    if (error instanceof PayloadTooLarge) return NextResponse.json({ error: error.message }, { status: 413 })
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Document upload error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
