import { prisma } from "@/lib/prisma"
import { SessionUser } from "@/lib/rbac"
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import React from "react"

// Register a font (optional, uses Helvetica by default)

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  scoreSection: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 20,
  },
  scoreBox: {
    width: 120,
    height: 120,
    borderWidth: 3,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreText: {
    fontSize: 28,
    fontWeight: "bold",
  },
  scoreLabel: {
    fontSize: 9,
    color: "#666",
    marginTop: 4,
  },
  summaryBox: {
    flex: 1,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 8,
    color: "#666",
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    padding: 8,
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  col1: { width: "5%" },
  col2: { width: "25%" },
  col3: { width: "12%" },
  col4: { width: "20%" },
  col5: { width: "18%" },
  col6: { width: "20%" },
  statusPass: { color: "#16a34a", fontWeight: "bold" },
  statusFail: { color: "#dc2626", fontWeight: "bold" },
  statusNotFound: { color: "#9ca3af" },
  statusReview: { color: "#d97706" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#999",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    paddingTop: 8,
  },
})

function getStatusStyle(status: string) {
  switch (status) {
    case "PASS": return styles.statusPass
    case "FAIL": return styles.statusFail
    case "NOT_FOUND": return styles.statusNotFound
    case "NEEDS_REVIEW": return styles.statusReview
    default: return {}
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#16a34a"
  if (score >= 50) return "#d97706"
  return "#dc2626"
}

function ComplianceReportPDF({
  documentName,
  checklistName,
  orgName,
  generatedAt,
  result,
}: {
  documentName: string
  checklistName: string
  orgName: string
  generatedAt: string
  result: { overallScore: number; totalItems: number; passedItems: number; failedItems: number; notFoundItems: number; summary: string | null; items: Array<{ fieldName: string; status: string; expected: string; extractedValue: string; notes: string }> }
}) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, "Compliance Report"),
        React.createElement(Text, { style: styles.subtitle }, `Organization: ${orgName}`),
        React.createElement(Text, { style: styles.subtitle }, `Document: ${documentName}`),
        React.createElement(Text, { style: styles.subtitle }, `Checklist: ${checklistName}`),
        React.createElement(Text, { style: styles.subtitle }, `Generated: ${generatedAt}`)
      ),

      // Score & Summary
      React.createElement(
        View,
        { style: styles.scoreSection },
        React.createElement(
          View,
          {
            style: {
              ...styles.scoreBox,
              borderColor: getScoreColor(result.overallScore),
            },
          },
          React.createElement(
            Text,
            {
              style: {
                ...styles.scoreText,
                color: getScoreColor(result.overallScore),
              },
            },
            `${result.overallScore}%`
          ),
          React.createElement(Text, { style: styles.scoreLabel }, "COMPLIANCE")
        ),
        React.createElement(
          View,
          { style: styles.summaryBox },
          React.createElement(Text, { style: styles.summaryTitle }, "Summary"),
          React.createElement(Text, { style: styles.summaryText }, result.summary || "No summary available.")
        )
      ),

      // Stats
      React.createElement(
        View,
        { style: styles.statsRow },
        ["Total", "Passed", "Failed", "Not Found"].map((label, i) => {
          const values = [result.totalItems, result.passedItems, result.failedItems, result.notFoundItems]
          const colors = ["#1a1a1a", "#16a34a", "#dc2626", "#9ca3af"]
          return React.createElement(
            View,
            { key: i, style: styles.statBox },
            React.createElement(Text, { style: { ...styles.statNumber, color: colors[i] } }, String(values[i])),
            React.createElement(Text, { style: styles.statLabel }, label)
          )
        })
      ),

      // Table Header
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(Text, { style: styles.col1 }, "#"),
        React.createElement(Text, { style: styles.col2 }, "Field"),
        React.createElement(Text, { style: styles.col3 }, "Status"),
        React.createElement(Text, { style: styles.col4 }, "Expected"),
        React.createElement(Text, { style: styles.col5 }, "Found"),
        React.createElement(Text, { style: styles.col6 }, "Notes")
      ),

      // Table Rows
      ...(result.items || []).map((item, index: number) =>
        React.createElement(
          View,
          {
            key: index,
            style: {
              ...styles.tableRow,
              ...(index % 2 === 1 ? styles.tableRowAlt : {}),
            },
          },
          React.createElement(Text, { style: styles.col1 }, String(index + 1)),
          React.createElement(Text, { style: styles.col2 }, item.fieldName),
          React.createElement(
            Text,
            { style: { ...styles.col3, ...getStatusStyle(item.status) } },
            item.status
          ),
          React.createElement(Text, { style: styles.col4 }, item.expected || "-"),
          React.createElement(Text, { style: styles.col5 }, item.extractedValue || "-"),
          React.createElement(Text, { style: styles.col6 }, item.notes || "-")
        )
      ),

      // Footer
      React.createElement(
        Text,
        { style: styles.footer },
        `Compliance Desk • ${orgName} • Generated ${generatedAt}`
      )
    )
  )
}

// GET /api/documents/[id]/results/pdf
export async function GET(
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

    // Fetch document
    const document = await prisma.document.findFirst({
      where: { id, orgId: user.orgId },
      include: { org: { select: { name: true } } },
    })

    if (!document) {
      return NextResponse.json(
        { error: "Document not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    // Fetch latest result
    const result = await prisma.complianceResult.findFirst({
      where: { documentId: id },
      include: {
        checklist: { select: { name: true } },
        items: {
          include: {
            checklistItem: {
              select: { fieldName: true, sortOrder: true, condition: true, thresholdValue: true, unit: true },
            },
          },
        },
      },
      orderBy: { generatedAt: "desc" },
    })

    if (!result) {
      return NextResponse.json(
        { error: "No compliance results found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    // Build items for PDF — Fix 21: Show actual expected values
    const pdfItems = result.items
      .sort((a, b) => a.checklistItem.sortOrder - b.checklistItem.sortOrder)
      .map((item) => {
        // Format expected value from checklist item
        let expected = "-"
        const ci = item.checklistItem
        if (ci.condition && ci.thresholdValue !== null && ci.thresholdValue !== undefined) {
          const condLabel: Record<string, string> = {
            LESS_THAN: "<",
            GREATER_THAN: ">",
            EQUALS: "=",
            MUST_BE_PRESENT: "Present",
            MUST_CONTAIN: "Contains",
            IS_TRUE: "True",
            RANGE: "Range",
          }
          const prefix = condLabel[ci.condition] || ci.condition
          const unit = ci.unit ? ` ${ci.unit}` : ""
          if (ci.condition === "MUST_BE_PRESENT" || ci.condition === "IS_TRUE") {
            expected = prefix
          } else {
            expected = `${prefix} ${ci.thresholdValue}${unit}`
          }
        }
        return {
          fieldName: item.checklistItem.fieldName,
          status: item.status,
          expected,
          extractedValue: item.extractedValue || "-",
          notes: item.notes || "-",
        }
      })

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      ComplianceReportPDF({
        documentName: document.name,
        checklistName: result.checklist.name,
        orgName: document.org.name,
        generatedAt: result.generatedAt.toLocaleString(),
        result: {
          overallScore: result.overallScore,
          totalItems: result.totalItems,
          passedItems: result.passedItems,
          failedItems: result.failedItems,
          notFoundItems: result.notFoundItems,
          summary: result.summary,
          items: pdfItems,
        },
      })
    )

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="compliance-report-${id}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    })
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught))
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("PDF export error:", error)
    return NextResponse.json(
      { error: "Failed to generate PDF", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
