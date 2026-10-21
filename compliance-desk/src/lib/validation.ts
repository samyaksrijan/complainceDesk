import { z } from "zod"

// ==================== AUTH SCHEMAS ====================

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  // Fix 27: Stronger password policy
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or less")
    .refine(value => new TextEncoder().encode(value).length <= 72, "Password must be at most 72 UTF-8 bytes")
    .refine(
      (val) => /[A-Z]/.test(val) || /[a-z]/.test(val),
      "Password must contain at least one letter"
    )
    .refine(
      (val) => /[0-9]/.test(val),
      "Password must contain at least one number"
    ),
  name: z.string().transform(sanitizeText).pipe(z.string().min(2, "Name must be at least 2 characters").max(100)),
  orgName: z.string().transform(sanitizeText).pipe(z.string().min(2, "Organization name must be at least 2 characters").max(100)),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

// ==================== CHECKLIST SCHEMAS ====================

// Valid conditions for each field type
const CONDITIONS_BY_TYPE: Record<string, string[]> = {
  NUMBER: ["LESS_THAN", "GREATER_THAN", "EQUALS", "RANGE"],
  BOOLEAN: ["IS_TRUE", "MUST_BE_PRESENT"],
  TEXT: ["EQUALS", "MUST_CONTAIN"],
  SELECT: ["EQUALS"],
}

const fieldTypeSchema = z.enum(["NUMBER", "BOOLEAN", "TEXT", "SELECT"])
const conditionSchema = z.enum([
  "LESS_THAN", "GREATER_THAN", "EQUALS", "RANGE",
  "MUST_BE_PRESENT", "MUST_CONTAIN", "IS_TRUE",
])

export const checklistItemSchema = z.object({
  fieldName: z.string().trim().min(1, "Field name is required").max(200),
  fieldType: fieldTypeSchema,
  unit: z.string().nullable().optional(),
  condition: conditionSchema,
  // Fix 22: Stronger thresholdValue validation
  thresholdValue: z.union([
    z.number(),
    z.string(),
    z.boolean(),
    z.array(z.number()),
  ]),
  options: z.array(z.string().trim().min(1)).nullable().optional(),
  sourceText: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  regulationRef: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0),
}).superRefine((item, ctx) => {
  // Validate condition is valid for the given field type
  const validConditions = CONDITIONS_BY_TYPE[item.fieldType]
  if (!validConditions.includes(item.condition)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Condition "${item.condition}" is not valid for field type "${item.fieldType}". Valid conditions: ${validConditions.join(", ")}`,
      path: ["condition"],
    })
  }

  // Validate threshold value matches field type
  if (item.fieldType === "NUMBER") {
    if (item.condition === "RANGE") {
      if (!Array.isArray(item.thresholdValue) || item.thresholdValue.length !== 2 || item.thresholdValue[0] > item.thresholdValue[1]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "RANGE condition requires thresholdValue to be an array of two numbers [min, max]",
          path: ["thresholdValue"],
        })
      }
    } else {
      if (typeof item.thresholdValue !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NUMBER field type requires thresholdValue to be a number",
          path: ["thresholdValue"],
        })
      }
    }
  }

  if (item.fieldType === "BOOLEAN") {
    if (item.thresholdValue !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "IS_TRUE and MUST_BE_PRESENT require a true target value",
        path: ["thresholdValue"],
      })
    }
  }

  if (item.fieldType === "SELECT") {
    if (!Array.isArray(item.options) || item.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SELECT field type requires a non-empty options array",
        path: ["options"],
      })
    }
    if (typeof item.thresholdValue !== "string" || !item.thresholdValue.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SELECT field type requires thresholdValue to be a string (the expected value)",
        path: ["thresholdValue"],
      })
    }
  }

  if (item.fieldType === "SELECT" && typeof item.thresholdValue === "string" && item.options && !item.options.includes(item.thresholdValue)) {
    ctx.addIssue({ code: "custom", message: "Expected value must be one of the allowed options", path: ["thresholdValue"] })
  }

  if (item.fieldType === "TEXT") {
    if (typeof item.thresholdValue !== "string" || !item.thresholdValue.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "TEXT field type requires thresholdValue to be a string",
        path: ["thresholdValue"],
      })
    }
  }
})

export const createChecklistSchema = z.object({
  name: z.string().trim().min(2, "Checklist name must be at least 2 characters").max(200),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  isTemplate: z.boolean().default(false),
  items: z.array(checklistItemSchema).min(1, "At least one checklist item is required").max(200),
})

export const updateChecklistSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  isTemplate: z.boolean().optional(),
  items: z.array(checklistItemSchema).min(1).max(200).optional(),
})

export const checklistQuerySchema = z.object({
  category: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  search: z.string().optional(),
  isTemplate: z.string().optional(), // "true" or "false" as string from query params
  page: z.string().default("1"),
  limit: z.string().default("20"),
})

// ==================== UTILITIES ====================

/**
 * Fix 8: Strip HTML tags and trim whitespace from a string.
 * Used for user-supplied text fields (names, org names).
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")  // Strip HTML tags
    .replace(/&[a-z]+;/gi, "") // Strip HTML entities
    .trim()
}

/**
 * Fix 10: Parse pagination parameters with safe defaults and caps.
 */
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

// ==================== TYPES ====================

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>
export type ChecklistQueryInput = z.infer<typeof checklistQuerySchema>
