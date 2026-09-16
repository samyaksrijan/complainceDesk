"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SkeletonCard } from "@/components/ui/skeleton-card"
import {
  ClipboardCheck,
  Search,
  Plus,
  Copy,
  Trash2,
  MoreHorizontal,
} from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ChecklistItem {
  id: string
  name: string
  description: string | null
  sourceType: string
  isTemplate: boolean
  itemsCount: number
  createdAt: string
  createdBy: { name: string } | null
}

export default function ChecklistsPage() {
  const router = useRouter()
  const { canEdit, isAdmin } = useAuth()
  usePageTitle("Checklists")

  const [checklists, setChecklists] = useState<ChecklistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "mine" | "templates">("all")
  const [filterSource, setFilterSource] = useState<string>("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchChecklists = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "12")
    if (search) params.set("search", search)
    if (filterType === "templates") params.set("isTemplate", "true")
    if (filterSource) params.set("sourceType", filterSource)

    const { data, error } = await api.get(
      `/api/checklists?${params.toString()}`
    )

    if (error) {
      toast.error("Failed to load checklists")
    } else if (data) {
      setChecklists(data.checklists || [])
      setTotalPages(data.pagination?.totalPages || 1)
    }
    setIsLoading(false)
  }, [page, search, filterType, filterSource])

  useEffect(() => {
    fetchChecklists()
  }, [fetchChecklists])

  // Debounce search
  const [searchInput, setSearchInput] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    const { error } = await api.delete(`/api/checklists/${deleteTarget.id}`)

    if (error) {
      toast.error(error)
    } else {
      toast.success("Checklist deleted")
      setDeleteTarget(null)
      fetchChecklists()
    }
    setIsDeleting(false)
  }

  const handleClone = async (id: string) => {
    const { error } = await api.post(`/api/checklists/${id}/clone`)

    if (error) {
      toast.error(error)
    } else {
      toast.success("Checklist cloned")
      fetchChecklists()
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Checklists"
        description="Create and manage compliance checklists"
        action={
          canEdit
            ? {
                label: "Create Checklist",
                icon: Plus,
                onClick: () => router.push("/checklists/new"),
              }
            : undefined
        }
      />

      {/* Filters bar */}
      <div
        className="flex items-center gap-3 mb-6 flex-wrap"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search checklists..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
            style={{
              background: "var(--bg-surface)",
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

        {/* Type filter */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {(["all", "mine", "templates"] as const).map((type) => (
            <button
              key={type}
              onClick={() => { setFilterType(type); setPage(1) }}
              className="px-3 py-2 text-xs font-medium capitalize transition-colors"
              style={{
                background: filterType === type ? "var(--green-900)" : "var(--bg-surface)",
                color: filterType === type ? "var(--green-300)" : "var(--text-muted)",
                borderRight: type !== "templates" ? "1px solid var(--border)" : "none",
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <select
          value={filterSource}
          onChange={(e) => { setFilterSource(e.target.value); setPage(1) }}
          className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: filterSource ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          <option value="">All sources</option>
          <option value="MANUAL">Manual</option>
          <option value="SCANNED">Scanned</option>
          <option value="TEMPLATE">Template</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : checklists.length === 0 ? (
        <div
          className="rounded-xl"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <EmptyState
            icon={ClipboardCheck}
            title="No checklists yet"
            description="Create your first compliance checklist to start evaluating documents against regulatory requirements."
            action={
              canEdit
                ? {
                    label: "Create Checklist",
                    onClick: () => router.push("/checklists/new"),
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {checklists.map((checklist, index) => (
              <div
                key={checklist.id}
                className="rounded-xl p-5 transition-all duration-200 cursor-pointer group animate-fade-up"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  animationDelay: `${index * 0.05}s`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-focus)"
                  e.currentTarget.style.transform = "translateY(-2px)"
                  e.currentTarget.style.boxShadow = "0 4px 12px var(--shadow)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "none"
                }}
                onClick={() => router.push(`/checklists/${checklist.id}`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {checklist.name}
                    </h3>
                  </div>

                  {/* Actions dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--text-muted)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleClone(checklist.id)
                        }}
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Clone
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(checklist)
                          }}
                          style={{ color: "var(--error)" }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Description */}
                {checklist.description && (
                  <p
                    className="text-xs mb-3 line-clamp-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {checklist.description}
                  </p>
                )}

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <StatusBadge status={checklist.sourceType} />
                  {checklist.isTemplate && (
                    <StatusBadge status="TEMPLATE" />
                  )}
                </div>

                {/* Footer */}
                <div
                  className="flex items-center justify-between pt-3"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {checklist.itemsCount} item{checklist.itemsCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {checklist.createdBy?.name || "Unknown"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Previous
              </button>
              <span className="text-sm px-3" style={{ color: "var(--text-muted)" }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Checklist"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone and will remove all items.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  )
}
