"use client"

// Types matching the backend
export interface ChecklistItemData {
  id: string // client-side temp ID for React keys
  fieldName: string
  fieldType: "NUMBER" | "BOOLEAN" | "TEXT" | "SELECT"
  condition: string
  thresholdValue: string | number | boolean | number[]
  unit: string
  options: string[]
  description: string
  isRequired: boolean
  sortOrder: number
}

// Available conditions per field type
export const CONDITIONS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  NUMBER: [
    { value: "LESS_THAN", label: "Less than" },
    { value: "GREATER_THAN", label: "Greater than" },
    { value: "EQUALS", label: "Equals" },
    { value: "RANGE", label: "Range (min - max)" },
  ],
  BOOLEAN: [
    { value: "MUST_BE_PRESENT", label: "Must be present" },
    { value: "IS_TRUE", label: "Must be true" },
  ],
  TEXT: [
    { value: "MUST_CONTAIN", label: "Must contain" },
    { value: "EQUALS", label: "Equals" },
  ],
  SELECT: [
    { value: "EQUALS", label: "Equals" },
  ],
}

// Default conditions when field type changes
export const DEFAULT_CONDITIONS: Record<string, string> = {
  NUMBER: "LESS_THAN",
  BOOLEAN: "MUST_BE_PRESENT",
  TEXT: "MUST_CONTAIN",
  SELECT: "EQUALS",
}

// Default threshold values per type+condition
export function getDefaultThreshold(fieldType: string, condition: string): ChecklistItemData["thresholdValue"] {
  if (fieldType === "BOOLEAN") return true
  if (fieldType === "NUMBER" && condition === "RANGE") return [0, 100]
  if (fieldType === "NUMBER") return 0
  if (fieldType === "TEXT") return ""
  if (fieldType === "SELECT") return ""
  return ""
}

let tempIdCounter = 0

export function createItem(sortOrder: number): ChecklistItemData {
  tempIdCounter++
  return {
    id: `temp_${tempIdCounter}_${Date.now()}`,
    fieldName: "",
    fieldType: "NUMBER",
    condition: "LESS_THAN",
    thresholdValue: 0,
    unit: "",
    options: [],
    description: "",
    isRequired: true,
    sortOrder,
  }
}
