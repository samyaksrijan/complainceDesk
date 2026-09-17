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
  Plus,
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
  const hasThreshold = !["BOOLEAN"].includes(item.fieldType)
  const isRange = item.condition === "RANGE"
  const isSelect = item.fieldType === "SELECT"

  const addOption = () => {
    const trimmed = optionInput.trim()
    if (trimmed && !item.options.includes(trimmed)) {
      onUpdate({ options: [...item.options, trimmed] })
      setOptionInput("")
    }
  }

  const removeOption = (opt: string) => {
    onUpdate({ options: item.options.filter((o) => o !== opt) })
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-xs transition-all hover:border-slate-300 font-sans">
      {/* Item header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer bg-slate-50/70 border-b border-slate-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold bg-white border border-slate-200 text-amber-700 font-mono shadow-2xs">
            {index + 1}
          </span>
          <div>
            <h4 className="text-xs font-bold text-slate-900 font-display">
              {item.fieldName || `Checkpoint Criterion ${index + 1}`}
            </h4>
            <span className="text-[10px] text-slate-400 font-mono font-medium">
              {item.fieldType} • {item.condition}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded text-slate-400 hover:text-slate-900 disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalItems - 1}
            className="p-1 rounded text-slate-400 hover:text-slate-900 disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1 rounded text-slate-400 hover:text-amber-600"
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded text-slate-400 hover:text-rose-600"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="p-4 space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Criterion Field Name</label>
              <input
                type="text"
                placeholder="e.g. Emergency Lighting Autonomy"
                value={item.fieldName}
                onChange={(e) => onUpdate({ fieldName: e.target.value })}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Data Type</label>
              <select
                value={item.fieldType}
                onChange={(e) => onUpdate({ fieldType: e.target.value as any })}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-amber-500 text-xs cursor-pointer"
              >
                <option value="NUMBER">Number (Numeric Threshold)</option>
                <option value="BOOLEAN">Boolean (Present / Confirmed)</option>
                <option value="TEXT">Text (Clause Qualitative Match)</option>
                <option value="SELECT">Select (Defined Value Set)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Condition Rule</label>
              <select
                value={item.condition}
                onChange={(e) => onUpdate({ condition: e.target.value as any })}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-amber-500 text-xs cursor-pointer"
              >
                {conditions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {hasThreshold && !isRange && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Required Target Value</label>
                <input
                  type={item.fieldType === "NUMBER" ? "number" : "text"}
                  placeholder="Target value"
                  value={item.thresholdValue ?? ""}
                  onChange={(e) => onUpdate({ thresholdValue: item.fieldType === "NUMBER" ? parseFloat(e.target.value) || 0 : e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 text-xs font-mono font-semibold"
                />
              </div>
            )}

            {hasThreshold && isRange && (
              <div className="space-y-1 sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Min Bound</label>
                  <input
                    type="number"
                    value={Array.isArray(item.thresholdValue) ? item.thresholdValue[0] : 0}
                    onChange={(e) => {
                      const max = Array.isArray(item.thresholdValue) ? item.thresholdValue[1] : 100
                      onUpdate({ thresholdValue: [parseFloat(e.target.value) || 0, max] })
                    }}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-amber-500 text-xs font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Max Bound</label>
                  <input
                    type="number"
                    value={Array.isArray(item.thresholdValue) ? item.thresholdValue[1] : 100}
                    onChange={(e) => {
                      const min = Array.isArray(item.thresholdValue) ? item.thresholdValue[0] : 0
                      onUpdate({ thresholdValue: [min, parseFloat(e.target.value) || 0] })
                    }}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-amber-500 text-xs font-mono font-semibold"
                  />
                </div>
              </div>
            )}

            {item.fieldType === "NUMBER" && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Unit</label>
                <input
                  type="text"
                  placeholder="e.g. meters, kN/m²"
                  value={item.unit || ""}
                  onChange={(e) => onUpdate({ unit: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 text-xs font-medium"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
