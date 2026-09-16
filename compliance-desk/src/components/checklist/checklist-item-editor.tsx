"use client"

import { useState } from "react"
import { ChecklistItemData, CONDITIONS_BY_TYPE } from "./checklist-types"
import {
  GripVertical,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react"

interface ChecklistItemEditorProps {
  item: ChecklistItemData
  index: number
  totalItems: number
  errors: Record<string, string>
  onUpdate: (updates: Partial<ChecklistItemData>) => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function ChecklistItemEditor({
  item,
  index,
  totalItems,
  errors,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: ChecklistItemEditorProps) {
  const [optionInput, setOptionInput] = useState("")
  const [isExpanded, setIsExpanded] = useState(true)

  const conditions = CONDITIONS_BY_TYPE[item.fieldType] || []
  const hasThreshold = !["BOOLEAN"].includes(item.fieldType) || false
  const isRange = item.condition === "RANGE"
  const isSelect = item.fieldType === "SELECT"

  // Add option to SELECT field
  const addOption = () => {
    const trimmed = optionInput.trim()
    if (trimmed && !item.options.includes(trimmed)) {
      onUpdate({ options: [...item.options, trimmed] })
      setOptionInput("")
    }
  }

  // Remove option
  const removeOption = (opt: string) => {
    onUpdate({ options: item.options.filter((o) => o !== opt) })
  }

  // Input styling (reused)
  const inputStyle = {
    background: "var(--bg-deep)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--green-500)"
    e.currentTarget.style.boxShadow = "0 0 0 3px var(--glow-green)"
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--border)"
    e.currentTarget.style.boxShadow = "none"
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Item header (always visible) */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        style={{ borderBottom: isExpanded ? "1px solid var(--border)" : "none" }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Index */}
        <span
          className="flex-shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-xs font-semibold"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-muted)",
          }}
        >
          {index + 1}
        </span>

        {/* Drag handle */}
        <div
          className="cursor-grab active:cursor-grabbing flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Item name preview */}
        <span
          className="flex-1 text-sm font-medium truncate"
          style={{ color: item.name ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {item.name || "Untitled item"}
        </span>

        {/* Quick actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp() }}
            disabled={index === 0}
            className="h-7 w-7 rounded flex items-center justify-center transition-colors disabled:opacity-20"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown() }}
            disabled={index === totalItems - 1}
            className="h-7 w-7 rounded flex items-center justify-center transition-colors disabled:opacity-20"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            className="h-7 w-7 rounded flex items-center justify-center transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="h-7 w-7 rounded flex items-center justify-center transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-4 space-y-4 animate-fade-in">
          {/* Row 1: Name + Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Field Name <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <input
                type="text"
                value={item.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="e.g., pH Level, Emission Certificate"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200"
                style={{
                  ...inputStyle,
                  border: errors[`item_${index}_name`]
                    ? "1px solid var(--error)"
                    : "1px solid var(--border)",
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              {errors[`item_${index}_name`] && (
                <p className="text-xs mt-1" style={{ color: "var(--error)" }}>
                  {errors[`item_${index}_name`]}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Field Type <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <select
                value={item.fieldType}
                onChange={(e) => onUpdate({ fieldType: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              >
                <option value="NUMBER">Number</option>
                <option value="BOOLEAN">Boolean (Yes/No)</option>
                <option value="TEXT">Text</option>
                <option value="SELECT">Select (Dropdown)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Condition + Threshold + Unit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Condition */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Condition <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <select
                value={item.condition}
                onChange={(e) => onUpdate({ condition: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              >
                {conditions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Threshold value — dynamic based on type */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                {item.fieldType === "BOOLEAN"
                  ? "Value"
                  : isRange
                  ? "Min Value"
                  : "Expected Value"}
              </label>

              {item.fieldType === "BOOLEAN" ? (
                <div
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: "var(--bg-deep)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  {item.condition === "MUST_BE_PRESENT" ? "Must be present" : "Must be true"}
                </div>
              ) : item.fieldType === "NUMBER" && isRange ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={Array.isArray(item.thresholdValue) ? item.thresholdValue[0] : 0}
                    onChange={(e) =>
                      onUpdate({
                        thresholdValue: [
                          parseFloat(e.target.value) || 0,
                          Array.isArray(item.thresholdValue) ? item.thresholdValue[1] : 100,
                        ],
                      })
                    }
                    placeholder="Min"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  <input
                    type="number"
                    value={Array.isArray(item.thresholdValue) ? item.thresholdValue[1] : 100}
                    onChange={(e) =>
                      onUpdate({
                        thresholdValue: [
                          Array.isArray(item.thresholdValue) ? item.thresholdValue[0] : 0,
                          parseFloat(e.target.value) || 100,
                        ],
                      })
                    }
                    placeholder="Max"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
              ) : item.fieldType === "NUMBER" ? (
                <input
                  type="number"
                  value={item.thresholdValue ?? ""}
                  onChange={(e) => onUpdate({ thresholdValue: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 50"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              ) : item.fieldType === "TEXT" ? (
                <input
                  type="text"
                  value={item.thresholdValue ?? ""}
                  onChange={(e) => onUpdate({ thresholdValue: e.target.value })}
                  placeholder={item.condition === "MUST_CONTAIN" ? 'e.g., "certified"' : 'e.g., "ISO 9001"'}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    ...inputStyle,
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                  }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              ) : (
                <select
                  value={item.thresholdValue ?? ""}
                  onChange={(e) => onUpdate({ thresholdValue: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                >
                  <option value="">Select expected value</option>
                  {item.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {errors[`item_${index}_threshold`] && (
                <p className="text-xs mt-1" style={{ color: "var(--error)" }}>
                  {errors[`item_${index}_threshold`]}
                </p>
              )}
            </div>

            {/* Unit (NUMBER only) */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Unit {item.fieldType !== "NUMBER" && "(number only)"}
              </label>
              <input
                type="text"
                value={item.unit}
                onChange={(e) => onUpdate({ unit: e.target.value })}
                placeholder="e.g., mg/L, ppm, %"
                disabled={item.fieldType !== "NUMBER"}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-40"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </div>

          {/* Row 3: SELECT options */}
          {isSelect && (
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Options <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {item.options.map((opt) => (
                  <span
                    key={opt}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium"
                    style={{
                      background: "var(--green-900)",
                      color: "var(--green-300)",
                    }}
                  >
                    {opt}
                    <button
                      onClick={() => removeOption(opt)}
                      className="ml-0.5 hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addOption() }
                  }}
                  placeholder="Type an option and press Enter"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  onClick={addOption}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--green-400)",
                  }}
                >
                  Add
                </button>
              </div>
              {errors[`item_${index}_options`] && (
                <p className="text-xs mt-1" style={{ color: "var(--error)" }}>
                  {errors[`item_${index}_options`]}
                </p>
              )}
            </div>
          )}

          {/* Row 4: Description + Required toggle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Description
              </label>
              <input
                type="text"
                value={item.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Optional helper text for auditors..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={item.isRequired}
                  onChange={(e) => onUpdate({ isRequired: e.target.checked })}
                  className="rounded"
                  style={{ accentColor: "var(--green-500)" }}
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Required
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
