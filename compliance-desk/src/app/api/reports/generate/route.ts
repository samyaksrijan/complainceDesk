import { prisma } from "@/lib/prisma"
import { SessionUser, withAuth } from "@/lib/rbac"
import { Prisma, Role } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

const generateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  checklistId: z.string().optional(),
  documentIds: z.array(z.string()).min(1).max(1000).optional(),
  dateRange: z.object({
    from: z.string().datetime(),
    to: z.string().datetime()
  }).refine(v => new Date(v.from) <= new Date(v.to), "Start must precede end").optional(),
  includeDetails: z.boolean().default(true),
  includeRecommendations: z.boolean().default(true),
})

export const POST = withAuth(
  async (req: Request, { user }: { user: SessionUser }) => {
    try {
      const body = await req.json()
      const parsed = generateSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        )
      }

      const {
        name,
        checklistId,
        documentIds,
        dateRange,
        includeDetails,
        includeRecommendations,
      } = parsed.data

      if (checklistId && !await prisma.checklist.findFirst({ where: { id: checklistId, OR: [{ orgId: user.orgId }, { isSystemTemplate: true }] } })) return NextResponse.json({ error: "Checklist not found" }, { status: 404 })
      if (documentIds && await prisma.document.count({ where: { id: { in: [...new Set(documentIds)] }, orgId: user.orgId } }) !== new Set(documentIds).size) return NextResponse.json({ error: "One or more documents were not found" }, { status: 404 })
      // Complete aggregation within the request; no process-local background job.
      // Create the report in GENERATING state
      const report = await prisma.report.create({
        data: {
          name,
          orgId: user.orgId,
          generatedById: user.id,
          checklistId: checklistId || null,
          dateRangeFrom: dateRange ? new Date(dateRange.from) : null,
          dateRangeTo: dateRange ? new Date(dateRange.to) : null,
          includeDetails,
          includeRecommendations,
          status: "GENERATING",
        },
      })

      await generateReportContent(report.id, user.orgId, parsed.data)
      const completed = await prisma.report.findUniqueOrThrow({ where: { id: report.id } })
      if (completed.status !== "READY") return NextResponse.json({ error: "No analyzed documents matched the criteria, or aggregation failed.", reportId: report.id }, { status: 422 })
      return NextResponse.json({ reportId: report.id, status: "READY" }, { status: 201 })
    } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("Generate report error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  },
  [Role.ADMIN, Role.AUDITOR] // Only Admins and Auditors can generate
)

// Background worker function
async function generateReportContent(reportId: string, orgId: string, options: z.infer<typeof generateSchema>) {

  try {
    // 1. Fetch matching documents and their compliance results
    const where: Prisma.DocumentWhereInput = { orgId }
    
    if (options.documentIds && options.documentIds.length > 0) {
      where.id = { in: options.documentIds }
    } else if (options.checklistId) {
      where.matchedChecklistId = options.checklistId
    }
    
    if (options.dateRange) {
      where.createdAt = {
        gte: new Date(options.dateRange.from),
        lte: new Date(options.dateRange.to),
      }
    }
    
    where.results = { some: {} }
    where.status = { in: ["COMPLIANT", "NON_COMPLIANT"] } // Only analyzed documents

    const documents = await prisma.document.findMany({
      where,
      include: {
        results: {
          orderBy: { generatedAt: "desc" },
          take: 1,
          include: {
            items: {
              include: {
                checklistItem: true,
              }
            }
          }
        },
        matchedChecklist: true,
      }
    })

    if (documents.length === 0) {
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "FAILED", content: { error: "No analyzed documents matched the criteria" } }
      })
      return
    }

    // 2. Compute aggregate metrics
    let totalScore = 0
    let compliantCount = 0
    let nonCompliantCount = 0
    
    let highestScore = { documentId: "", documentName: "", score: -1 }
    let lowestScore = { documentId: "", documentName: "", score: 101 }

    const documentResults = []
    const sectionStats: Record<string, { totalScore: number, count: number, pass: number, fail: number, warn: number }> = {}

    for (const doc of documents) {
      // Find latest result
      const latestResult = doc.results.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0]
      if (!latestResult) continue

      const score = latestResult.overallScore
      totalScore += score
      if (doc.status === "COMPLIANT") compliantCount++
      else nonCompliantCount++

      if (score > highestScore.score) {
        highestScore = { documentId: doc.id, documentName: doc.name, score }
      }
      if (score < lowestScore.score) {
        lowestScore = { documentId: doc.id, documentName: doc.name, score }
      }

      // Group section scores
      // Since checklists don't explicitly have "sections" in our current schema, we can derive it from tags or category, 
      // but let's fake a breakdown based on field categories or just use the checklist name as a section for multi-checklist reports.
      const checklistName = doc.matchedChecklist?.name || "Uncategorized"
      if (!sectionStats[checklistName]) {
        sectionStats[checklistName] = { totalScore: 0, count: 0, pass: 0, fail: 0, warn: 0 }
      }
      sectionStats[checklistName].totalScore += score
      sectionStats[checklistName].count++
      
      const docSectionScores = [{ title: checklistName, score, status: doc.status }]
      
      const findings = []
      for (const item of latestResult.items) {
        if (item.status === "PASS") sectionStats[checklistName].pass++
        else if (item.status === "FAIL") sectionStats[checklistName].fail++
        else sectionStats[checklistName].warn++

        if (options.includeDetails) {
          findings.push({
            clause: item.checklistItem.fieldName,
            result: item.status,
            detail: item.notes || item.extractedValue || "No details provided",
            recommendation: options.includeRecommendations && item.status !== "PASS" 
              ? "Review the corresponding section in the policy and align it with the required controls."
              : undefined
          })
        }
      }

      documentResults.push({
        documentId: doc.id,
        documentName: doc.name,
        score,
        status: doc.status,
        sectionScores: docSectionScores,
        findings: options.includeDetails ? findings : undefined
      })
    }

    const averageScore = documents.length > 0 ? Math.round((totalScore / documents.length) * 10) / 10 : 0
    
    const sectionBreakdown = Object.keys(sectionStats).map(title => ({
      sectionTitle: title,
      averageScore: Math.round((sectionStats[title].totalScore / sectionStats[title].count) * 10) / 10,
      passCount: sectionStats[title].pass,
      failCount: sectionStats[title].fail,
      warningCount: sectionStats[title].warn,
    }))

    const reportContent = {
      summary: {
        totalDocuments: documents.length,
        compliantCount,
        nonCompliantCount,
        averageScore,
        highestScore,
        lowestScore,
      },
      sectionBreakdown,
      documentResults,
    }

    // 3. Save report content and mark READY
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "READY",
        documentCount: documents.length,
        averageScore,
        content: JSON.parse(JSON.stringify(reportContent)),
        completedAt: new Date(),
      }
    })

    // Optionally notify the user (if we wanted to integrate with notifications)

  } catch (err) {
    console.error("Report generation failed:", err)
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "FAILED" }
    }).catch(console.error)
  }
}
