import { prisma } from "@/lib/prisma"
import { extractDocumentValues, ExtractedValue, generateSummary } from "@/services/llm"
import { ChecklistItem } from "@prisma/client"

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
export function parseNumber(value: string | null): number | null {
  if (value == null) return null
  const match = value.trim().match(/[-+]?\d(?:[\d.,\u00a0 ]*\d)?/)
  if (!match) return null
  let numeric = match[0].replace(/[\s\u00a0]/g, "")
  const comma = numeric.lastIndexOf(","), dot = numeric.lastIndexOf(".")
  if (comma >= 0 && dot >= 0) numeric = comma > dot ? numeric.replaceAll(".", "").replace(",", ".") : numeric.replaceAll(",", "")
  else if (comma >= 0) numeric = /^[-+]?\d{1,3}(,\d{3})+$/.test(numeric) ? numeric.replaceAll(",", "") : numeric.replace(",", ".")
  else if ((numeric.match(/\./g) || []).length > 1) numeric = /^[-+]?\d{1,3}(\.\d{3})+$/.test(numeric) ? numeric.replaceAll(".", "") : "invalid"
  const result = Number(numeric)
  return Number.isFinite(result) ? result : null
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
export function formatThreshold(condition: string, thresholdValue: unknown, unit?: string | null): string {
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
export function evaluateItem(
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

  if (extraction.needs_review) return { status: "NEEDS_REVIEW", extractedValue: extraction.extracted_value, sourceExcerpt: extraction.source_excerpt, notes: extraction.note || "Conflicting evidence requires review" }

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
          const pass = lowerValue.trim() === thresholdStr.trim()

          return {
            status: pass ? "PASS" : "FAIL",
            extractedValue: rawValue,
            sourceExcerpt,
            notes: pass ? null : `Value "${rawValue}" does not match expected "${item.thresholdValue}"`,
          }
        }

        break
      }
    }
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught))
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
  checklistId: string,
  lease?: Date
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

    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim()
    const cited = extraction?.source_excerpt && normalize(document.extractedText!).includes(normalize(extraction.source_excerpt))
    const evaluation = extraction?.found && !cited
      ? { status: "NEEDS_REVIEW" as const, extractedValue: extraction.extracted_value, sourceExcerpt: extraction.source_excerpt, notes: "The extracted value has no verifiable source citation in the document." }
      : evaluateItem(item, extraction)

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

  // Missing evidence remains part of the compliance obligation.
  const evaluatedItems = totalItems
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

  await prisma.$transaction(async (tx) => {
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
            status: evaluation.status,
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

    const updated = await tx.document.updateMany({
      where: { id: documentId, ...(lease ? { processingStartedAt: lease, status: "PROCESSING" } : {}) },
      data: { status: newStatus, processingStartedAt: null },
    })
    if (updated.count !== 1) throw new Error("This evaluation was superseded. Please refresh the document.")

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
