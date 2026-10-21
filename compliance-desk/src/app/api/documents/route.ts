import { prisma } from "@/lib/prisma"
import { SessionUser, withAnyRole } from "@/lib/rbac"
import { parsePagination } from "@/lib/validation"
import { DocumentStatus, Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

// GET /api/documents — List documents
export const GET = withAnyRole(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const url = new URL(req.url)
      const status = url.searchParams.get("status") || undefined
      const search = url.searchParams.get("search") || undefined

      // Fix 10: Safe pagination with cap
      const { page, limit, skip } = parsePagination(url.searchParams)

      const where: Prisma.DocumentWhereInput = {
        orgId: user.orgId,
      }

      if (status && Object.values(DocumentStatus).includes(status as DocumentStatus)) {
        where.status = status as DocumentStatus
      }

      if (search) {
        where.name = { contains: search, mode: "insensitive" }
      }

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where,
          include: {
            uploadedBy: { select: { id: true, name: true } },
            matchedChecklist: { select: { id: true, name: true } },
            results: {
              select: { id: true, overallScore: true, generatedAt: true },
              orderBy: { generatedAt: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.document.count({ where }),
      ])

      // Transform: remove extractedText from list (too large for list view)
      const result = documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        fileType: doc.fileType,
        status: doc.status,
        matchedChecklist: doc.matchedChecklist,
        uploadedBy: doc.uploadedBy,
        latestScore: doc.results[0]?.overallScore ?? null,
        createdAt: doc.createdAt,
      }))

      return NextResponse.json({
        documents: result,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("List documents error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
