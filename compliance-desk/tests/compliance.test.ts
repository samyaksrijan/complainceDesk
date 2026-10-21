import { describe, expect, it, vi } from "vitest"
import type { ChecklistItem } from "@prisma/client"
const mocks = vi.hoisted(() => ({ document: { findUnique: vi.fn(), updateMany: vi.fn() }, checklist: { findUnique: vi.fn() }, complianceResult: { create: vi.fn() }, extract: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { ...mocks, $transaction: async (fn: (tx: typeof mocks) => unknown) => fn(mocks) } }))
vi.mock("@/services/llm", () => ({ extractDocumentValues: mocks.extract, generateSummary: async () => "Summary" }))
import { evaluateItem, parseNumber, runComplianceCheck } from "@/services/compliance"
const criterion: ChecklistItem = { id: "i1", checklistId: "c1", fieldName: "Height", fieldType: "NUMBER", condition: "LESS_THAN", thresholdValue: 50, unit: "m", options: null, sourceText: null, confidence: null, regulationRef: null, sortOrder: 0, createdAt: new Date() }
const evidence = { field_name: "Height", extracted_value: "42", found: true, source_excerpt: "Height is 42m" }
describe("compliance decisions", () => {
  it.each([["12.500,50 m",12500.5],["12,500.50 m",12500.5],["3,5 m",3.5],["5.2 kN/m²",5.2],["-5 m",-5],["unknown",null]])("parses measurement %s", (raw, expected) => expect(parseNumber(raw)).toBe(expected))
  it("does not treat negated or ambiguous boolean evidence as a pass", () => expect(evaluateItem({ ...criterion, fieldType: "BOOLEAN", condition: "IS_TRUE", thresholdValue: true }, { ...evidence, extracted_value: "not present" }).status).toBe("NEEDS_REVIEW"))
  it("requires the expected select value, not just any allowed option", () => expect(evaluateItem({ ...criterion, fieldType: "SELECT", condition: "EQUALS", thresholdValue: "approved", options: ["approved", "rejected"] }, { ...evidence, extracted_value: "rejected" }).status).toBe("FAIL"))
  it("flags conflicting evidence for manual review", () => expect(evaluateItem(criterion, { ...evidence, needs_review: true }).status).toBe("NEEDS_REVIEW"))
  it("scores four missing requirements as nonconforming", async () => {
    mocks.document.findUnique.mockResolvedValue({ extractedText: "Height is 42m. Other controls are not documented." })
    mocks.checklist.findUnique.mockResolvedValue({ items: Array.from({ length: 5 }, (_,i) => ({ ...criterion, id: `i${i}`, fieldName: i ? `Other ${i}` : "Height" })) })
    mocks.extract.mockResolvedValue({ extractions: [evidence] })
    mocks.complianceResult.create.mockResolvedValue({ id: "r1" }); mocks.document.updateMany.mockResolvedValue({ count: 1 })
    const result = await runComplianceCheck("d1", "c1")
    expect(result.overallScore).toBe(20)
    expect(result.notFoundItems).toBe(4)
    expect(mocks.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "NON_COMPLIANT", processingStartedAt: null } }))
  })
  it("rejects empty checklists before making an AI call", async () => {
    mocks.document.findUnique.mockResolvedValue({ extractedText: "Text" }); mocks.checklist.findUnique.mockResolvedValue({ items: [] })
    await expect(runComplianceCheck("d1", "c1")).rejects.toThrow("Checklist has no items")
    expect(mocks.extract).not.toHaveBeenCalled()
  })
})
