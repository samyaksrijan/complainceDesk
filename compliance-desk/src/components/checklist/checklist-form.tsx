"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { ChecklistItemEditor } from "./checklist-item-editor"
import {
  ChecklistItemData,
  DEFAULT_CONDITIONS,
  getDefaultThreshold,
  createItem,
} from "./checklist-types"
import { toast } from "sonner"
import { Plus, Save, ArrowLeft } from "lucide-react"

interface ChecklistFormProps {
  mode: "create" | "edit"
  initialData?: {
    name: string
    description: string
    isTemplate: boolean
    items: ChecklistItemData[]
  }
  onSubmit: (payload: any) => Promise<{ error: string | null; data: any }>
  onSuccess: (data: any) => void
  cancelUrl: string
}

export function ChecklistForm({
  mode,
  initialData,
  onSubmit,
  onSuccess,
  cancelUrl,
}: ChecklistFormProps) {
  const router = useRouter()

  const [name, setName] = useState(initialData?.name || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [isTemplate, setIsTemplate] = useState(initialData?.isTemplate || false)
  const [items, setItems] = useState<ChecklistItemData[]>(
    initialData?.items || [createItem(0), createItem(1), createItem(2)]
  )
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Add new item
  const addItem = () => {
    setItems((prev) => [...prev, createItem(prev.length)])
  }

  // Update item
  const updateItem = (index: number, updates: Partial<ChecklistItemData>) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }

      // If field type changed, reset condition and threshold
      if (updates.fieldType && updates.fieldType !== prev[index].fieldType) {
        next[index].condition = DEFAULT_CONDITIONS[updates.fieldType] || ""
        next[index].thresholdValue = getDefaultThreshold(
          updates.fieldType,
          next[index].condition
        )
        if (updates.fieldType !== "SELECT") {
          next[index].options = []
        }
      }

      // If condition changed for number, handle RANGE
      if (updates.condition && updates.condition !== prev[index].condition) {
        if (updates.condition === "RANGE") {
          next[index].thresholdValue = [0, 100]
        } else if (prev[index].condition === "RANGE") {
          next[index].thresholdValue = 0
        }
      }

      // Update sort orders
      next.forEach((item, i) => { item.sortOrder = i })

      return next
    })
  }

  // Delete item
  const deleteItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("Checklist must have at least one item")
      return
    }
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index)
      next.forEach((item, i) => { item.sortOrder = i })
      return next
    })
  }

  // Duplicate item
  const duplicateItem = (index: number) => {
    setItems((prev) => {
      const source = prev[index]
      const duplicate: ChecklistItemData = {
        ...source,
        id: createItem(0).id, // generate new ID
        name: `${source.name} (copy)`,
        sortOrder: index + 1,
      }
      const next = [...prev]
      next.splice(index + 1, 0, duplicate)
      next.forEach((item, i) => { item.sortOrder = i })
      return next
    })
  }

  // Move item (reorder)
  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return
    setItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      next.forEach((item, i) => { item.sortOrder = i })
      return next
    })
  }

  // Validate
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = "Checklist name is required"
    }

    items.forEach((item, index) => {
      if (!item.name.trim()) {
        newErrors[`item_${index}_name`] = "Field name is required"
      }
      if (item.fieldType === "SELECT" && item.options.length === 0) {
        newErrors[`item_${index}_options`] = "Add at least one option"
      }
      if (item.fieldType === "TEXT" && item.condition === "EQUALS" && !item.thresholdValue) {
        newErrors[`item_${index}_threshold`] = "Expected value is required"
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save
  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fix the errors before saving")
      return
    }

    setIsSaving(true)

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      isTemplate,
      items: items.map((item) => ({
        name: item.name.trim(),
        fieldType: item.fieldType,
        condition: item.condition,
        thresholdValue: item.thresholdValue,
        unit: item.unit.trim() || undefined,
        options: item.fieldType === "SELECT" ? item.options : undefined,
        description: item.description.trim() || undefined,
        isRequired: item.isRequired,
        sortOrder: item.sortOrder,
      })),
    }

    const { data, error } = await onSubmit(payload)

    if (error) {
      toast.error(error)
    } else {
      onSuccess(data)
    }

    setIsSaving(false)
  }

  return (
    <div className="animate-fade-up max-w-4xl">
      {/* Back button */}
      <button
        onClick={() => router.push(cancelUrl)}
        className="flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <ArrowLeft className="h-4 w-4" />
        {mode === "create" ? "Back to checklists" : "Back to checklist"}
      </button>

      <PageHeader title={mode === "create" ? "Create Checklist" : "Edit Checklist"} />

      {/* Checklist metadata */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Checklist name <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: "" })) }}
              placeholder="e.g., ISO 14001 Environmental Compliance"
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200"
              style={{
                background: "var(--bg-deep)",
                border: errors.name
                  ? "1px solid var(--error)"
                  : "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--green-500)"
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--glow-green)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = errors.name ? "var(--error)" : "var(--border)"
                e.currentTarget.style.boxShadow = "none"
              }}
            />
            {errors.name && (
              <p className="text-xs mt-1" style={{ color: "var(--error)" }}>
                {errors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this checklist..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200 resize-none"
              style={{
                background: "var(--bg-deep)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--green-500)"
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--glow-green)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)"
                e.currentTarget.style.boxShadow = "none"
              }}
            />
          </div>

          {/* Template toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className="relative h-5 w-9 rounded-full transition-colors cursor-pointer"
              style={{
                background: isTemplate ? "var(--green-600)" : "var(--bg-elevated)",
                border: "1px solid var(--border)",
              }}
              onClick={() => setIsTemplate(!isTemplate)}
            >
              <div
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                style={{
                  transform: isTemplate ? "translateX(16px)" : "translateX(1px)",
                }}
              />
            </div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Mark as template (available to all organizations)
            </span>
          </label>
        </div>
      </div>

      {/* Items section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-display" style={{ color: "var(--text-primary)" }}>
            Checklist Items
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {items.length} item{items.length !== 1 ? "s" : ""} — drag to reorder
          </p>
        </div>
        <button
          onClick={addItem}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            border: "1px solid var(--border)",
            color: "var(--green-400)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--green-600)"
            e.currentTarget.style.background = "var(--glow-soft)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)"
            e.currentTarget.style.background = "transparent"
          }}
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-3 mb-8">
        {items.map((item, index) => (
          <ChecklistItemEditor
            key={item.id}
            item={item}
            index={index}
            totalItems={items.length}
            errors={errors}
            onUpdate={(updates) => updateItem(index, updates)}
            onDelete={() => deleteItem(index)}
            onDuplicate={() => duplicateItem(index)}
            onMoveUp={() => moveItem(index, index - 1)}
            onMoveDown={() => moveItem(index, index + 1)}
          />
        ))}
      </div>

      {/* Add item button (bottom) */}
      <button
        onClick={addItem}
        className="w-full py-4 rounded-xl text-sm font-medium transition-all duration-200 mb-8 flex items-center justify-center gap-2"
        style={{
          border: "2px dashed var(--border)",
          color: "var(--text-muted)",
          background: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--green-700)"
          e.currentTarget.style.color = "var(--green-400)"
          e.currentTarget.style.background = "var(--glow-soft)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)"
          e.currentTarget.style.color = "var(--text-muted)"
          e.currentTarget.style.background = "transparent"
        }}
      >
        <Plus className="h-4 w-4" />
        Add another item
      </button>

      {/* Bottom action bar */}
      <div
        className="sticky bottom-0 py-4 flex items-center justify-between"
        style={{
          background: "linear-gradient(to top, var(--bg-base) 60%, transparent)",
        }}
      >
        <button
          onClick={() => router.push(cancelUrl)}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50"
          style={{ background: "var(--green-600)", color: "white" }}
          onMouseEnter={(e) => {
            if (!isSaving) {
              e.currentTarget.style.background = "var(--green-500)"
              e.currentTarget.style.transform = "translateY(-1px)"
              e.currentTarget.style.boxShadow = "0 4px 12px var(--glow-green)"
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--green-600)"
            e.currentTarget.style.transform = "translateY(0)"
            e.currentTarget.style.boxShadow = "none"
          }}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : mode === "create" ? "Save Checklist" : "Update Checklist"}
        </button>
      </div>
    </div>
  )
}
