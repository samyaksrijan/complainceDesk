import Groq from "groq-sdk"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { z } from "zod"

// ==================== CLIENT INITIALIZATION ====================

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// ==================== CONFIGURATION ====================

const CONFIG = {
  primaryProvider: process.env.LLM_PRIMARY_PROVIDER || "groq",
  fallbackProvider: process.env.LLM_FALLBACK_PROVIDER || "gemini",
  temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.1"),
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "4096"),
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  maxRetries: 2,
}

// ==================== CORE LLM CALL ====================

interface LLMResponse {
  content: string
  provider: string
  model: string
  tokensUsed?: number
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  const response = await groq.chat.completions.create({
    model: CONFIG.groqModel,
    temperature: CONFIG.temperature,
    max_tokens: CONFIG.maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  })

  const content = response.choices[0]?.message?.content || ""
  const tokensUsed = response.usage?.total_tokens

  return {
    content,
    provider: "groq",
    model: CONFIG.groqModel,
    tokensUsed,
  }
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  const model = genAI.getGenerativeModel({
    model: CONFIG.geminiModel,
    systemInstruction: systemPrompt,
  })

  const result = await model.generateContent(userPrompt)
  const content = result.response.text()

  return {
    content,
    provider: "gemini",
    model: CONFIG.geminiModel,
  }
}

/**
 * Call LLM with automatic fallback.
 * Tries primary provider first, falls back on failure.
 * Retries once on the same provider before switching.
 */
async function callLLM(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  const primaryFn = CONFIG.primaryProvider === "groq" ? callGroq : callGemini
  const fallbackFn = CONFIG.fallbackProvider === "groq" ? callGroq : callGemini

  // Try primary provider (with one retry)
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const result = await primaryFn(systemPrompt, userPrompt)
      return result
    } catch (error: any) {
      console.error(`[LLM] Primary (${CONFIG.primaryProvider}) attempt ${attempt} failed:`, error.message)
      if (attempt === CONFIG.maxRetries) {
        console.log(`[LLM] Primary exhausted, trying fallback...`)
      }
    }
  }

  // Try fallback provider
  try {
    const result = await fallbackFn(systemPrompt, userPrompt)
    return result
  } catch (error: any) {
    console.error(`[LLM] Fallback (${CONFIG.fallbackProvider}) failed:`, error.message)
    throw new Error(`Both LLM providers failed. Last error: ${error.message}`)
  }
}

// ==================== JSON PARSING ====================

/**
 * Parse LLM response as JSON with Zod validation.
 * Handles: direct JSON, JSON wrapped in markdown code blocks.
 */
function parseJSON<T>(raw: string, schema: z.ZodSchema<T>): T {
  // Try direct parse
  try {
    const parsed = JSON.parse(raw.trim())
    return schema.parse(parsed)
  } catch {
    // Try extracting JSON from markdown code block
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      const parsed = JSON.parse(codeBlockMatch[1].trim())
      return schema.parse(parsed)
    }

    // Try finding JSON array or object in the text
    const jsonArrayMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonArrayMatch) {
      const parsed = JSON.parse(jsonArrayMatch[0])
      return schema.parse(parsed)
    }

    const jsonObjectMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonObjectMatch) {
      const parsed = JSON.parse(jsonObjectMatch[0])
      return schema.parse(parsed)
    }

    throw new Error(`Failed to parse LLM response as JSON. Raw response (first 200 chars): ${raw.substring(0, 200)}`)
  }
}

// ==================== PROMPT TEMPLATES ====================

const CHECKLIST_SCAN_SYSTEM_PROMPT = `You are a compliance document parser. Your task is to extract 
structured checklist items from compliance/regulation text.

For each item you find, return a JSON object with these fields:
- field_name: A short, descriptive label for the requirement
- field_type: One of "number", "boolean", "text", "select"
- unit: The unit of measurement if applicable (e.g., "meters", 
  "hours", "persons", "%"), or null if not applicable
- condition: One of "less_than", "greater_than", "equals", 
  "range", "must_be_present", "must_contain", "is_true"
- threshold_value: The specific limit or required value. For 
  "range" condition, use [min, max] array. For numbers, use 
  the number. For booleans, use true/false.
- source_text: The exact sentence or phrase from the document 
  where this item was identified
- confidence: A number from 0.0 to 1.0 indicating how confident 
  you are in the extraction accuracy
- regulation_ref: Any section number, standard reference, or 
  code reference mentioned (e.g., "Section 4.1"), or null

FIELD TYPE DETECTION RULES:
- Measurable quantity with a numerical limit (height, weight, 
  distance, time, count, percentage, capacity) → "number"
- Something must be present, absent, true, or false → "boolean"
- Specific allowed values from a defined list → "select"
- Qualitative, subjective, or descriptive requirement 
  (adequate, sufficient, proper) → "text"

CONDITION DETECTION RULES:
- "shall not exceed", "maximum", "must not be more than", 
  "not more than" → "less_than"
- "minimum", "at least", "must be no less than", 
  "no less than" → "greater_than"  
- "must be", "shall be exactly", "equal to" → "equals"
- "between X and Y", "from X to Y", "range" → "range"
- "must be present", "must have", "is required", 
  "shall include" → "must_be_present"
- "must contain", "must include", "shall contain" → "must_contain"

Return ONLY a valid JSON object with a single key "items" 
containing an array of checklist items. Example format:
{
  "items": [
    {
      "field_name": "Building Height",
      "field_type": "number",
      "unit": "meters",
      "condition": "less_than",
      "threshold_value": 50,
      "source_text": "Building height shall not exceed 50 meters",
      "confidence": 0.97,
      "regulation_ref": "Section 4.1"
    }
  ]
}

No markdown, no explanations, just the JSON object.`

const VALUE_EXTRACTION_SYSTEM_PROMPT = `You are a document analysis system. Given an audit/inspection 
document and a list of compliance fields to check, extract the 
actual values for each field from the document.

For each field, return:
- field_name: The exact field name from the input list
- extracted_value: The actual value found in the document 
  as a string. For numbers, return just the number as a string 
  (e.g., "42" not "42 meters"). For booleans, return "true" or 
  "false". If not found, return null.
- source_excerpt: The exact sentence or paragraph (50-200 chars) 
  from the document where the value was found. If not found, 
  return null.
- found: true if value was found, false if not
- note: Any relevant note about the extraction 
  (e.g., "value estimated from context"), or null

Be precise with numerical values. Extract only the number, 
without units. If a document says "height: 42 meters", 
extracted_value should be "42".

For boolean fields, look for positive indicators like "present", 
"installed", "confirmed", "available", "yes" → true. 
Negative indicators like "absent", "missing", "not found", 
"no" → false.

Return ONLY a valid JSON object with a single key "extractions" 
containing an array. Example format:
{
  "extractions": [
    {
      "field_name": "Building Height",
      "extracted_value": "42",
      "source_excerpt": "Building height: 42 meters (measured from ground level)",
      "found": true,
      "note": null
    },
    {
      "field_name": "Sprinkler System",
      "extracted_value": "true",
      "source_excerpt": "Sprinkler system: present on all floors",
      "found": true,
      "note": null
    }
  ]
}

No markdown, no explanations, just the JSON object.`

const SUMMARY_SYSTEM_PROMPT = `You are a compliance reporting assistant. Given compliance check 
results, write a concise 2-3 sentence professional summary.

Include:
1. Overall pass rate (X of Y items passed)
2. What categories or areas passed (group similar items)
3. What failed specifically, with the actual values vs required values

Keep it factual. No speculation. No recommendations.
Return ONLY the summary text, no JSON, no formatting.`

// ==================== RESPONSE SCHEMAS ====================

const extractedChecklistItemSchema = z.object({
  field_name: z.string().min(1),
  field_type: z.enum(["number", "boolean", "text", "select"]),
  unit: z.string().nullable().optional(),
  condition: z.enum([
    "less_than", "greater_than", "equals", "range",
    "must_be_present", "must_contain", "is_true",
  ]),
  threshold_value: z.any(),
  source_text: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  regulation_ref: z.string().nullable().optional(),
})

const checklistScanResponseSchema = z.object({
  items: z.array(extractedChecklistItemSchema),
})

const extractedValueSchema = z.object({
  field_name: z.string(),
  extracted_value: z.string().nullable(),
  source_excerpt: z.string().nullable(),
  found: z.boolean(),
  note: z.string().nullable().optional(),
})

const valueExtractionResponseSchema = z.object({
  extractions: z.array(extractedValueSchema),
})

// ==================== EXPORTED TYPES ====================

export type ExtractedChecklistItem = z.infer<typeof extractedChecklistItemSchema>
export type ExtractedValue = z.infer<typeof extractedValueSchema>

export interface ChecklistScanResult {
  items: ExtractedChecklistItem[]
  rawResponse: string
  provider: string
  model: string
  tokensUsed?: number
}

export interface ValueExtractionResult {
  extractions: ExtractedValue[]
  rawResponse: string
  provider: string
  model: string
  tokensUsed?: number
}

// ==================== EXPORTED FUNCTIONS ====================

/**
 * Scan a compliance document and extract checklist fields.
 * 
 * @param documentText - Raw text extracted from compliance document
 * @returns Structured checklist items with confidence scores
 */
export async function scanChecklistDocument(
  documentText: string
): Promise<ChecklistScanResult> {
  if (!documentText || documentText.trim().length < 50) {
    throw new Error("Document text is too short to scan (minimum 50 characters)")
  }

  // Truncate very long documents to stay within token limits
  const maxChars = 15000
  const truncatedText = documentText.length > maxChars
    ? documentText.substring(0, maxChars) + "\n\n[Document truncated...]"
    : documentText

  const userPrompt = `Extract checklist items from the following compliance document:\n\n${truncatedText}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const response = await callLLM(CHECKLIST_SCAN_SYSTEM_PROMPT, userPrompt)

      const parsed = parseJSON(response.content, checklistScanResponseSchema)

      // Normalize field types and conditions to uppercase (for Prisma enum)
      const normalizedItems = parsed.items.map((item, index) => ({
        ...item,
        field_type: item.field_type.toUpperCase() as any,
        condition: item.condition.toUpperCase() as any,
        // Ensure confidence defaults if missing
        confidence: item.confidence ?? 0.5,
        // Ensure unit is null not undefined
        unit: item.unit || null,
        // Ensure regulation_ref is null not undefined
        regulation_ref: item.regulation_ref || null,
        // Add sort order based on position
        sort_order: index,
      }))

      return {
        items: normalizedItems as any,
        rawResponse: response.content,
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
      }
    } catch (error: any) {
      lastError = error
      console.error(`[Scan] Attempt ${attempt} failed:`, error.message)

      if (attempt < CONFIG.maxRetries) {
        // Add retry instruction to prompt
        console.log(`[Scan] Retrying with emphasis on JSON format...`)
      }
    }
  }

  throw new Error(`Checklist scan failed after ${CONFIG.maxRetries} attempts: ${lastError?.message}`)
}

/**
 * Extract actual values from an audit document for given checklist fields.
 * 
 * @param documentText - Raw text from audit document
 * @param fields - Array of checklist field definitions
 * @returns Extracted values with source excerpts
 */
export async function extractDocumentValues(
  documentText: string,
  fields: Array<{
    fieldName: string
    fieldType: string
    condition: string
    thresholdValue: any
    unit?: string | null
  }>
): Promise<ValueExtractionResult> {
  if (!documentText || documentText.trim().length < 20) {
    throw new Error("Document text is too short to extract values from")
  }

  if (!fields || fields.length === 0) {
    throw new Error("No fields provided for extraction")
  }

  // Truncate long documents
  const maxChars = 15000
  const truncatedText = documentText.length > maxChars
    ? documentText.substring(0, maxChars) + "\n\n[Document truncated...]"
    : documentText

  // Build field descriptions for the prompt
  const fieldDescriptions = fields.map((f, i) => {
    let desc = `${i + 1}. "${f.fieldName}" (type: ${f.fieldType}, condition: ${f.condition}`
    if (f.unit) desc += `, unit: ${f.unit}`
    if (f.fieldType === "NUMBER" && f.condition === "RANGE") {
      desc += `, expected range: ${JSON.stringify(f.thresholdValue)}`
    } else {
      desc += `, expected: ${f.thresholdValue}`
    }
    desc += `)`
    return desc
  }).join("\n")

  const userPrompt = `Document text:\n${truncatedText}\n\nFields to extract:\n${fieldDescriptions}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const response = await callLLM(VALUE_EXTRACTION_SYSTEM_PROMPT, userPrompt)

      const parsed = parseJSON(response.content, valueExtractionResponseSchema)

      return {
        extractions: parsed.extractions,
        rawResponse: response.content,
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
      }
    } catch (error: any) {
      lastError = error
      console.error(`[Extract] Attempt ${attempt} failed:`, error.message)
    }
  }

  throw new Error(`Value extraction failed after ${CONFIG.maxRetries} attempts: ${lastError?.message}`)
}

/**
 * Generate a natural language summary of compliance results.
 * 
 * @param results - Object with pass/fail details
 * @returns Summary text string
 */
export async function generateSummary(results: {
  totalItems: number
  passedItems: number
  failedItems: number
  notFoundItems: number
  details: Array<{
    fieldName: string
    status: string
    expected: string
    found: string | null
  }>
}): Promise<string> {
  const detailsText = results.details.map((d) => {
    return `- ${d.fieldName}: ${d.status} (expected: ${d.expected}, found: ${d.found || "not found"})`
  }).join("\n")

  const userPrompt = `Compliance check results:
Total items: ${results.totalItems}
Passed: ${results.passedItems}
Failed: ${results.failedItems}
Not found: ${results.notFoundItems}

Details:
${detailsText}`

  try {
    const response = await callLLM(SUMMARY_SYSTEM_PROMPT, userPrompt)
    return response.content.trim()
  } catch (error: any) {
    console.error("[Summary] Generation failed:", error.message)
    // Return a basic summary if LLM fails
    return `Compliance check completed: ${results.passedItems} of ${results.totalItems} items passed. ${results.failedItems} failed. ${results.notFoundItems} values not found in document.`
  }
}

// ==================== HEALTH CHECK ====================

/**
 * Test if LLM providers are reachable.
 */
export async function healthCheck(): Promise<{
  groq: boolean
  gemini: boolean
}> {
  const results = { groq: false, gemini: false }

  try {
    await callGroq("Reply with only the word 'ok'.", "ping")
    results.groq = true
  } catch (e) {
    console.error("[HealthCheck] Groq failed:", (e as Error).message)
  }

  try {
    await callGemini("Reply with only the word 'ok'.", "ping")
    results.gemini = true
  } catch (e) {
    console.error("[HealthCheck] Gemini failed:", (e as Error).message)
  }

  return results
}
