import { prisma } from "@/lib/prisma"
import { extractDocumentValues, generateSummary, ExtractedValue } from "@/services/llm"
import { FieldType, Condition, ChecklistItem } from "@prisma/client"

interface EvaluationResult {
  status: "PASS" | "FAIL" | "NOT_FOUND" | "NEEDS_REVIEW"
  extractedValue: string | null
  sourceExcerpt: string | null
  notes: string | null
}

interface ComplianceCheckResult {
  overallScore: number
  totalItems: number
  passedItems: number
  failedItems: number
  notFoundItems: number
  needsReviewItems: number
  summary: string
  items: Array<{
    checklistItemId: string
    fieldName: string
    status: string
    expected: string
    extractedValue: string | null
    sourceExcerpt: string | null
    notes: string | null
  }>
}

/**
 * Parse a numeric value from a string.
 * Returns null if not parseable.
 */
function parseNumber(value: string | null): number | null {
  if (value === null || value === undefined) return null
  const cleaned = value.toString().replace(/[^0-9.\-]/g, "")
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Parse a boolean value from a string.
 */
function parseBoolean(value: string | null): boolean | null {
  if (value === null || value === undefined) return null
  const lower = value.toString().toLowerCase().trim()
  if (["true", "yes", "present", "available", "installed", "confirmed", "compliant", "1"].includes(lower)) return true
  if (["false", "no", "absent", "missing", "unavailable", "not found", "0"].includes(lower)) return false
  return null
}

/**
 * Format a threshold value for display.
 */
function formatThreshold(condition: string, thresholdValue: any, unit?: string | null): string {
  const unitStr = unit ? ` ${unit}` : ""
  switch (condition) {
    case "LESS_THAN":
      return `< ${thresholdValue}${unitStr}`
    case "GREATER_THAN":
      return `> ${thresholdValue}${unitStr}`
    case "EQUALS":
      return `= ${thresholdValue}${unitStr}`
    case "RANGE":
      if (Array.isArray(thresholdValue)) {
        return `${thresholdValue[0]} - ${thresholdValue[1]}${unitStr}`
      }
      return `${thresholdValue}${unitStr}`
    case "MUST_BE_PRESENT":
      return "must be present"
    case "MUST_CONTAIN":
      return `must contain "${thresholdValue}"`
    case "IS_TRUE":
      return "must be true"
    default:
      return `${thresholdValue}${unitStr}`
  }
}

/**
 * Evaluate a single checklist item against an extracted value.
 */
function evaluateItem(
  item: ChecklistItem,
  extraction: ExtractedValue | undefined
): EvaluationResult {
  // Value not found in document
  if (!extraction || !extraction.found || extraction.extracted_value === null) {
    return {
      status: "NOT_FOUND",
      extractedValue: null,
      sourceExcerpt: extraction?.source_excerpt || null,
      notes: "Value not found in document",
    }
  }

  const rawValue = extraction.extracted_value
  const sourceExcerpt = extraction.source_excerpt || null

  try {
    switch (item.fieldType) {
      case "NUMBER": {
        const numValue = parseNumber(rawValue)
        if (numValue === null) {
          return {
            status: "NEEDS_REVIEW",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: `Could not parse "${rawValue}" as a number`,
          }
        }

        const threshold = item.thresholdValue as number

        if (item.condition === "LESS_THAN") {
          const pass = numValue < threshold
          return {
            status: pass ? "PASS" : "FAIL",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: pass ? null : `${numValue} exceeds maximum of ${threshold}`,
          }
        }

        if (item.condition === "GREATER_THAN") {
          const pass = numValue > threshold
          return {
            status: pass ? "PASS" : "FAIL",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: pass ? null : `${numValue} is below minimum of ${threshold}`,
          }
        }

        if (item.condition === "EQUALS") {
          const pass = Math.abs(numValue - threshold) < 0.001
          return {
            status: pass ? "PASS" : "FAIL",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: pass ? null : `${numValue} does not equal ${threshold}`,
          }
        }

        if (item.condition === "RANGE") {
          const range = item.thresholdValue as number[]
          if (!Array.isArray(range) || range.length !== 2) {
            return {
              status: "NEEDS_REVIEW",
              extractedValue: rawValue,
              sourceExcerpt,
              notes: "Invalid range configuration",
            }
          }
          const pass = numValue >= range[0] && numValue <= range[1]
          return {
            status: pass ? "PASS" : "FAIL",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: pass ? null : `${numValue} is outside range [${range[0]}, ${range[1]}]`,
          }
        }

        break
      }

      case "BOOLEAN": {
        const boolValue = parseBoolean(rawValue)
        if (boolValue === null) {
          // Could not determine — check if the raw text suggests presence
          const lower = rawValue.toLowerCase()
          const seemsPresent = ["present", "yes", "installed", "available", "confirmed", "operational", "compliant"].some(
            (word) => lower.includes(word)
          )
          if (seemsPresent) {
            return {
              status: "PASS",
              extractedValue: rawValue,
              sourceExcerpt,
              notes: null,
            }
          }
          return {
            status: "NEEDS_REVIEW",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: `Could not determine boolean value from "${rawValue}"`,
          }
        }

        if (item.condition === "IS_TRUE" || item.condition === "MUST_BE_PRESENT") {
          return {
            status: boolValue ? "PASS" : "FAIL",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: boolValue ? null : "Required item not present",
          }
        }

        break
      }

      case "TEXT": {
        const lowerValue = rawValue.toLowerCase()
        const thresholdStr = (item.thresholdValue as string).toLowerCase()

        if (item.condition === "MUST_CONTAIN") {
          const pass = lowerValue.includes(thresholdStr)
          return {
            status: pass ? "PASS" : "FAIL",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: pass ? null : `Text does not contain "${item.thresholdValue}"`,
          }
        }

        if (item.condition === "EQUALS") {
          const pass = lowerValue === thresholdStr
          return {
            status: pass ? "PASS" : "FAIL",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: pass ? null : `Text does not equal "${item.thresholdValue}"`,
          }
        }

        break
      }

      case "SELECT": {
        if (item.condition === "EQUALS") {
          const thresholdStr = (item.thresholdValue as string).toLowerCase()
          const lowerValue = rawValue.toLowerCase()
          const pass = lowerValue === thresholdStr || lowerValue.includes(thresholdStr)

          // Also check against options array if present
          let passViaOptions = false
          if (item.options && Array.isArray(item.options)) {
            passViaOptions = (item.options as string[]).some(
              (opt) => lowerValue.includes(opt.toLowerCase())
            )
          }

          return {
            status: (pass || passViaOptions) ? "PASS" : "FAIL",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: (pass || passViaOptions) ? null : `Value "${rawValue}" does not match expected "${item.thresholdValue}"`,
          }
        }

        break
      }
    }
  } catch (error: any) {
    return {
      status: "NEEDS_REVIEW",
      extractedValue: rawValue,
      sourceExcerpt,
      notes: `Evaluation error: ${error.message}`,
    }
  }

  // Fallback — should not reach here
  return {
    status: "NEEDS_REVIEW",
    extractedValue: rawValue,
    sourceExcerpt,
    notes: `Unhandled condition: ${item.condition} for type ${item.fieldType}`,
  }
}

/**
 * Run a full compliance check on a document against a checklist.
 *
 * @param documentId - Document ID
 * @param checklistId - Checklist ID
 * @returns Full compliance results with per-item evaluations
 */
export async function runComplianceCheck(
  documentId: string,
  checklistId: string
): Promise<ComplianceCheckResult> {
  // Fetch document
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  if (!document) throw new Error("Document not found")
  if (!document.extractedText) throw new Error("Document has no extracted text")

  // Fetch checklist with items
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
  })

  if (!checklist) throw new Error("Checklist not found")
  if (checklist.items.length === 0) throw new Error("Checklist has no items")

  // Step 1: Extract values from document using LLM
  const fields = checklist.items.map((item) => ({
    fieldName: item.fieldName,
    fieldType: item.fieldType,
    condition: item.condition,
    thresholdValue: item.thresholdValue,
    unit: item.unit,
  }))

  const extractionResult = await extractDocumentValues(
    document.extractedText,
    fields
  )

  // Step 2: Evaluate each item
  const evaluations = checklist.items.map((item) => {
    const extraction = extractionResult.extractions.find(
      (e) => e.field_name.toLowerCase() === item.fieldName.toLowerCase()
    )

    const evaluation = evaluateItem(item, extraction)

    return {
      checklistItemId: item.id,
      fieldName: item.fieldName,
      fieldType: item.fieldType,
      condition: item.condition,
      thresholdValue: item.thresholdValue,
      unit: item.unit,
      ...evaluation,
    }
  })

  // Step 3: Calculate scores
  const passedItems = evaluations.filter((e) => e.status === "PASS").length
  const failedItems = evaluations.filter((e) => e.status === "FAIL").length
  const notFoundItems = evaluations.filter((e) => e.status === "NOT_FOUND").length
  const needsReviewItems = evaluations.filter((e) => e.status === "NEEDS_REVIEW").length
  const totalItems = evaluations.length

  // Score = passed / (total - notFound) * 100
  const evaluatedItems = totalItems - notFoundItems
  const overallScore = evaluatedItems > 0
    ? Math.round((passedItems / evaluatedItems) * 10000) / 100
    : 0

  // Step 4: Generate summary
  const summaryInput = {
    totalItems,
    passedItems,
    failedItems,
    notFoundItems,
    details: evaluations.map((e) => ({
      fieldName: e.fieldName,
      status: e.status,
      expected: formatThreshold(e.condition, e.thresholdValue, e.unit),
      found: e.extractedValue,
    })),
  }

  let summary: string
  try {
    summary = await generateSummary(summaryInput)
  } catch {
    summary = `Compliance check: ${passedItems}/${totalItems} items passed. ${failedItems} failed. ${notFoundItems} not found.`
  }

  // Add context when NEEDS_REVIEW items exist
  if (needsReviewItems > 0) {
    summary += ` Note: ${needsReviewItems} item(s) require manual review before final compliance determination.`
  }

  // Step 5: Save results and update document status atomically
  const newStatus = overallScore >= 100 ? "COMPLIANT" : "NON_COMPLIANT"

  const result = await prisma.$transaction(async (tx) => {
    const complianceResult = await tx.complianceResult.create({
      data: {
        documentId,
        checklistId,
        overallScore,
        totalItems,
        passedItems,
        failedItems,
        notFoundItems,
        summary,
        items: {
          create: evaluations.map((evaluation) => ({
            checklistItemId: evaluation.checklistItemId,
            status: evaluation.status as any,
            extractedValue: evaluation.extractedValue,
            sourceExcerpt: evaluation.sourceExcerpt,
            notes: evaluation.notes,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    await tx.document.update({
      where: { id: documentId },
      data: { status: newStatus },
    })

    return complianceResult
  })

  return {
    overallScore,
    totalItems,
    passedItems,
    failedItems,
    notFoundItems,
    needsReviewItems,
    summary,
    items: evaluations.map((e) => ({
      checklistItemId: e.checklistItemId,
      fieldName: e.fieldName,
      status: e.status,
      expected: formatThreshold(e.condition, e.thresholdValue, e.unit),
      extractedValue: e.extractedValue,
      sourceExcerpt: e.sourceExcerpt,
      notes: e.notes,
    })),
  }
}
