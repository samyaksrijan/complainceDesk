import { describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock("groq-sdk", () => ({ default: class { chat = { completions: { create: mocks.create } } } }))
import { extractDocumentValues, scanChecklistDocument, splitDocument } from "@/services/llm"
const field = { fieldName: "Lighting", fieldType: "NUMBER", condition: "GREATER_THAN", thresholdValue: 120 }
describe("AI document coverage", () => {
  it("covers the end of long documents", async () => {
    mocks.create.mockImplementation(async ({ messages }) => ({ choices: [{ message: { content: JSON.stringify({ extractions: [{ field_name: "Lighting", found: messages[1].content.includes("TAIL_REQUIREMENT"), extracted_value: messages[1].content.includes("TAIL_REQUIREMENT") ? "180" : null, source_excerpt: "Lighting 180 minutes" }] }) } }] }))
    const result = await extractDocumentValues("Policy content ".repeat(1500)+"TAIL_REQUIREMENT: Lighting 180 minutes", [field])
    expect(mocks.create.mock.calls.length).toBeGreaterThan(1)
    expect(result.extractions[0].extracted_value).toBe("180")
  })
  it("marks conflicting evidence across segments for review", async () => {
    let n = 0
    mocks.create.mockImplementation(async () => ({ choices: [{ message: { content: JSON.stringify({ extractions: [{ field_name: "Lighting", found: true, extracted_value: String(++n * 60), source_excerpt: "Lighting duration" }] }) } }] }))
    const result = await extractDocumentValues("Policy content ".repeat(1500), [field])
    expect(result.extractions[0].needs_review).toBe(true)
  })
  it("normalizes scanned checklist types for the API", async () => {
    mocks.create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ items: [{ field_name: "Sprinklers", field_type: "boolean", condition: "is_true", threshold_value: null, confidence: 0.9 }] }) } }] })
    const result = await scanChecklistDocument("Sprinklers shall be present in all rooms. ".repeat(3))
    expect(result.items[0]).toMatchObject({ field_type: "BOOLEAN", condition: "IS_TRUE", threshold_value: true })
  })
  it("rejects oversized text instead of silently dropping sections", () => expect(() => splitDocument("x".repeat(240001))).toThrow("Split it"))
})
