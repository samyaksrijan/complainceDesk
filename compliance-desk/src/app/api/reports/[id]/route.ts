import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth, SessionUser } from "@/lib/rbac"
import { Role } from "@prisma/client"

export const GET = withAuth(
  async (
    req: Request,
    { user, params }: { user: SessionUser; params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params

      const report = await prisma.report.findFirst({
        where: { id, orgId: user.orgId },
        include: {
          generatedBy: { select: { id: true, name: true } },
          checklist: { select: { name: true } }
        },
      })

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }

      // Map to ReportDetail shape
      const detail = {
        id: report.id,
        name: report.name,
        status: report.status,
        generatedBy: report.generatedBy,
        checklistId: report.checklistId,
        checklistName: report.checklist?.name || null,
        dateRange: report.dateRangeFrom && report.dateRangeTo 
          ? { from: report.dateRangeFrom.toISOString(), to: report.dateRangeTo.toISOString() }
          : null,
        includeDetails: report.includeDetails,
        includeRecommendations: report.includeRecommendations,
        createdAt: report.createdAt.toISOString(),
        completedAt: report.completedAt?.toISOString() || null,
        // Content contains summary, sectionBreakdown, documentResults
        ...(report.content as any || {}),
      }

      return NextResponse.json(detail)
    } catch (error) {
      console.error("Get report detail error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
)

export const DELETE = withAuth(
  async (
    req: Request,
    { user, params }: { user: SessionUser; params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params

      // Only admins and auditors can delete reports
      if (user.role === Role.VIEWER) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const report = await prisma.report.findFirst({
        where: { id, orgId: user.orgId },
      })

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }

      await prisma.report.delete({ where: { id } })

      return new NextResponse(null, { status: 204 })
    } catch (error) {
      console.error("Delete report error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
)
