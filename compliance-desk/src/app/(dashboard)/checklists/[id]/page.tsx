"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { usePageTitle } from "@/lib/use-page-title"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import {
  ArrowLeft,
  Edit,
  Copy,
  Trash2,
  Calendar,
  User,
  Hash,
} from "lucide-react"

interface ChecklistDetail {
  id: string
  name: string
  description: string | null
  sourceType: string
  isTemplate: boolean
  createdAt: string
  createdBy: { name: string } | null
  items: {
    id: string
    name: string
    description: string | null
    fieldType: string
    condition: string
    thresholdValue: any
    unit: string | null
    options: string[] | null
    isRequired: boolean
    sortOrder: number
  }[]
}

// Format expected value for display
function formatExpected(item: ChecklistDetail["items"][0]): string {
  const { fieldType, condition, thresholdValue, unit } = item
  const unitSuffix = unit ? ` ${unit}` : ""

  if (fieldType === "BOOLEAN") {
    return condition === "MUST_BE_PRESENT" ? "Must be present" : "Must be true"
  }

  if (fieldType === "NUMBER") {
    if (condition === "LESS_THAN") return `< ${thresholdValue}${unitSuffix}`
    if (condition === "GREATER_THAN") return `> ${thresholdValue}${unitSuffix}`
    if (condition === "EQUALS") return `= ${thresholdValue}${unitSuffix}`
    if (condition === "RANGE" && Array.isArray(thresholdValue)) {
      return `${thresholdValue[0]} — ${thresholdValue[1]}${unitSuffix}`
    }
  }

  if (fieldType === "TEXT") {
    if (condition === "MUST_CONTAIN") return `Contains "${thresholdValue}"`
    if (condition === "EQUALS") return `= "${thresholdValue}"`
  }

  if (fieldType === "SELECT") {
    return `= "${thresholdValue}"`
  }

  return String(thresholdValue || "-")
}

export default function ChecklistDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { canEdit, isAdmin } = useAuth()
  const id = params.id as string

  const [checklist, setChecklist] = useState<ChecklistDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  usePageTitle(checklist?.name || "Checklist Detail")

  useEffect(() => {
    const fetchChecklist = async () => {
      setIsLoading(true)
      const { data, error } = await api.get(`/api/checklists/${id}`)
      if (error) {
        toast.error("Failed to load checklist")
        router.push("/checklists")
      } else {
        setChecklist(data)
      }
      setIsLoading(false)
    }
    fetchChecklist()
  }, [id, router])

  const handleDelete = async () => {
    setIsDeleting(true)
    const { error } = await api.delete(`/api/checklists/${id}`)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Checklist deleted")
      router.push("/checklists")
    }
    setIsDeleting(false)
  }

  const handleClone = async () => {
    setIsCloning(true)
    const { data, error } = await api.post(`/api/checklists/${id}/clone`)
    if (error) {
      toast.error(error)
    } else {
      toast.success("Checklist cloned")
      router.push(`/checklists/${data.id}`)
    }
    setIsCloning(false)
  }

  if (isLoading) {
    return (
      <div className="animate-fade-up max-w-4xl">
        <div className="space-y-4">
          <div className="h-6 w-32 rounded animate-shimmer-green" />
          <div className="h-10 w-2/3 rounded animate-shimmer-green" />
          <div className="h-4 w-1/3 rounded animate-shimmer-green" />
          <div className="h-64 rounded-xl animate-shimmer-green mt-8" />
        </div>
      </div>
    )
  }

  if (!checklist) return null

  return (
    <div className="animate-fade-up max-w-4xl">
      {/* Back */}
      <button
        onClick={() => router.push("/checklists")}
        className="flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to checklists
      </button>

      {/* Header */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1
                className="text-xl font-display"
                style={{ color: "var(--text-primary)" }}
              >
                {checklist.name}
              </h1>
              <StatusBadge status={checklist.sourceType} size="md" />
              {checklist.isTemplate && <StatusBadge status="TEMPLATE" size="md" />}
            </div>
            {checklist.description && (
              <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                {checklist.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {checklist.createdBy?.name || "Unknown"}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(checklist.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                {checklist.items.length} item{checklist.items.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => router.push(`/checklists/${id}/edit`)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--green-600)"
                  e.currentTarget.style.color = "var(--green-400)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.color = "var(--text-secondary)"
                }}
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
            )}
            <button
              onClick={handleClone}
              disabled={isCloning}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <Copy className="h-4 w-4" />
              {isCloning ? "Cloning..." : "Clone"}
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--error)"
                  e.currentTarget.style.color = "var(--error)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.color = "var(--text-muted)"
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Table header */}
        <div
          className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
          style={{
            gridTemplateColumns: "40px 1fr 100px 130px 1fr 70px 80px",
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          <span>#</span>
          <span>Field Name</span>
          <span>Type</span>
          <span>Condition</span>
          <span>Expected</span>
          <span>Req.</span>
          <span>Description</span>
        </div>

        {/* Table rows */}
        {checklist.items
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item, index) => (
            <div
              key={item.id}
              className="grid gap-4 px-5 py-3 text-sm items-center transition-colors"
              style={{
                gridTemplateColumns: "40px 1fr 100px 130px 1fr 70px 80px",
                borderBottom: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glow-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {index + 1}
              </span>
              <span className="font-medium">{item.name}</span>
              <span>
                <StatusBadge status={item.fieldType} />
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {item.condition.replace(/_/g, " ")}
              </span>
              <span className="font-mono text-xs" style={{ color: "var(--green-300)" }}>
                {formatExpected(item)}
              </span>
              <span className="text-xs">
                {item.isRequired ? (
                  <span style={{ color: "var(--success)" }}>Yes</span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>No</span>
                )}
              </span>
              <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {item.description || "-"}
              </span>
            </div>
          ))}
      </div>

      {/* Delete dialog */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Checklist"
        description={`Are you sure you want to delete "${checklist.name}"? All items will be permanently removed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  )
}
