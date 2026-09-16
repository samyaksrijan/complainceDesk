import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuditorOrAdmin, withAnyRole, SessionUser } from "@/lib/rbac"
import { createChecklistSchema, checklistQuerySchema, parsePagination } from "@/lib/validation"
import { logActivity } from "@/services/activity"
import { Prisma } from "@prisma/client"

// GET /api/checklists — List checklists
export const GET = withAnyRole(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const url = new URL(req.url)

      // Fix 10: Safe pagination with cap
      const { page, limit, skip } = parsePagination(url.searchParams)

      const queryParams = {
        category: url.searchParams.get("category") || undefined,
        tags: url.searchParams.get("tags") || undefined,
        search: url.searchParams.get("search") || undefined,
        isTemplate: url.searchParams.get("isTemplate") || undefined,
      }

      // Fix 9: Template cross-org visibility
      const where: Prisma.ChecklistWhereInput = {}

      if (queryParams.isTemplate === "true") {
        // Show templates from ALL orgs + own org's checklists
        where.OR = [
          { orgId: user.orgId },
          { isTemplate: true },
        ]
      } else {
        where.orgId = user.orgId
      }

      if (queryParams.category) {
        where.category = queryParams.category
      }

      if (queryParams.tags) {
        const tagList = queryParams.tags.split(",").map((t) => t.trim())
        where.tags = { hasSome: tagList }
      }

      if (queryParams.search) {
        where.name = { contains: queryParams.search, mode: "insensitive" }
      }

      if (queryParams.isTemplate !== undefined && queryParams.isTemplate !== "true") {
        where.isTemplate = queryParams.isTemplate === "true"
      }

      const [checklists, total] = await Promise.all([
        prisma.checklist.findMany({
          where,
          include: {
            items: { select: { id: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.checklist.count({ where }),
      ])

      // Transform: add itemsCount, remove full items array
      const result = checklists.map((cl) => ({
        id: cl.id,
        name: cl.name,
        description: cl.description,
        category: cl.category,
        tags: cl.tags,
        sourceType: cl.sourceType,
        isTemplate: cl.isTemplate,
        itemsCount: cl.items.length,
        createdBy: cl.createdBy,
        createdAt: cl.createdAt,
        updatedAt: cl.updatedAt,
      }))

      return NextResponse.json({
        checklists: result,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error("List checklists error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)

// POST /api/checklists — Create a new checklist with items
export const POST = withAuditorOrAdmin(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const body = await req.json()
      const parsed = createChecklistSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        )
      }

      const { name, description, category, tags, isTemplate, items } = parsed.data

      const checklist = await prisma.checklist.create({
        data: {
          name,
          description: description || null,
          category: category || null,
          tags,
          sourceType: "MANUAL",
          isTemplate,
          orgId: user.orgId,
          createdById: user.id,
          items: {
            create: items.map((item) => ({
              fieldName: item.fieldName,
              fieldType: item.fieldType,
              unit: item.unit || null,
              condition: item.condition,
              thresholdValue: item.thresholdValue,
              options: item.options || null,
              sourceText: item.sourceText || null,
              confidence: item.confidence || null,
              regulationRef: item.regulationRef || null,
              sortOrder: item.sortOrder,
            })),
          },
        },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          createdBy: { select: { id: true, name: true } },
        },
      })

      // Fix 23: Use logActivity service (silent fail)
      logActivity({
        orgId: user.orgId,
        userId: user.id,
        action: "checklist.created",
        resourceType: "checklist",
        resourceId: checklist.id,
        metadata: { name: checklist.name, itemsCount: items.length },
      })

      return NextResponse.json(checklist, { status: 201 })
    } catch (error) {
      console.error("Create checklist error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
)
