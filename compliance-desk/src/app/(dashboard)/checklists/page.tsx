"use client"

import { PaginationControls } from "@/components/ui/pagination-controls"

import { useAuth } from "@/components/providers/auth-provider"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { StatusBadge } from "@/components/ui/status-badge"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import {
    ArrowRight,
    BookOpen,
    Copy,
    Plus,
    Search,
    Trash2
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface ChecklistItem {
  id: string
  name: string
  description: string | null
  category?: string
  sourceType: string
  isTemplate: boolean
  itemsCount: number
  createdAt: string
  createdBy: { name: string } | null
}

export default function ChecklistsPage() {
  const router = useRouter()
  const { canEdit, isAdmin } = useAuth()
  usePageTitle("Compliance Standards")

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [checklists, setChecklists] = useState<ChecklistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "templates" | "custom">("all")
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchChecklists = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "24")
    if (search) params.set("search", search)
    if (filterType === "templates") params.set("isTemplate", "true")
    if (filterType === "custom") params.set("isTemplate", "false")

    const { data, error } = await api.get<{ checklists: ChecklistItem[]; pagination: { total: number; totalPages: number } }>(
      `/api/checklists?${params.toString()}`
    )

    if (error) toast.error(error)
    setChecklists(data?.checklists || [])
    setTotal(data?.pagination.total || 0)
    setTotalPages(data?.pagination.totalPages || 1)
    setIsLoading(false)
  }, [page, search, filterType])

  useEffect(() => {
    void Promise.resolve().then(fetchChecklists)
  }, [fetchChecklists])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    const { error } = await api.delete(`/api/checklists/${deleteTarget.id}`)
    setIsDeleting(false)

    if (error) {
      toast.error(error)
    } else {
      toast.success("Standard checklist removed")
      setDeleteTarget(null)
      fetchChecklists()
    }
  }

  const handleClone = async (id: string, name: string) => {
    toast.info(`Cloning '${name}' as new editable standard…`)
    try {
      const { data, error } = await api.post<{ id: string }>(`/api/checklists/${id}/clone`, {})
      if (error || !data) {
        toast.error(error || "Failed to clone template")
      } else {
        toast.success("Standard cloned successfully")
        router.push(`/checklists/${data.id}`)
      }
    } catch {
      toast.error("Clone failed")
    }
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
              Regulatory Frameworks
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">
            Compliance Standards & Checklists
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Define, ingest, and manage rule criteria for automated audit verification.
          </p>
        </div>

        <div>
          <button
            disabled={!canEdit}
            onClick={() => router.push("/checklists/new")}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-brand-400" />
            New Standard / Ingest Policy
          </button>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => { setFilterType("all"); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            All Frameworks
          </button>
          <button
            onClick={() => { setFilterType("templates"); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === "templates"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Standard Presets
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search standards…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 font-medium"
          />
        </div>
      </div>

      {/* Standards Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))
        ) : checklists.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-bold text-slate-700 font-display">No standards found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Create a standard or adjust active filters.</p>
          </div>
        ) : (
          checklists.map((chk) => (
            <div
              key={chk.id}
              className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                    {chk.category || "General Compliance"}
                  </span>
                  <StatusBadge status={chk.sourceType} size="sm" />
                </div>

                <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-800 transition-colors leading-snug font-display">
                  {chk.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                  {chk.description || "No standard description provided."}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  <strong className="text-slate-800 font-mono">{chk.itemsCount || 0}</strong> Checkpoints
                </div>

                <div className="flex items-center gap-1.5">
                  {chk.isTemplate && canEdit && (
                    <button
                      onClick={() => handleClone(chk.id, chk.name)}
                      className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-brand-700 hover:border-brand-200 transition-colors"
                      title="Clone standard template"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/checklists/${chk.id}`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1"
                  >
                    Inspect <ArrowRight className="h-3 w-3 text-brand-600" />
                  </button>
                  {isAdmin && !chk.isTemplate && (
                    <button
                      onClick={() => setDeleteTarget(chk)}
                      className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete standard"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Regulatory Standard"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Any active mapping referencing this checklist will be invalidated.`}
        confirmLabel={isDeleting ? "Deleting..." : "Delete Standard"}
        variant="destructive"
        onConfirm={handleDelete}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      />
      <PaginationControls page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </div>
  )
}
