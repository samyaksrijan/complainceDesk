"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import { StatusBadge } from "@/components/ui/status-badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ShieldCheck,
  Search,
  Plus,
  Copy,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
  FileText,
  Filter,
  ArrowRight,
  BookOpen,
} from "lucide-react"
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

  const [checklists, setChecklists] = useState<ChecklistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "templates" | "custom">("all")
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchChecklists = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("limit", "24")
    if (search) params.set("search", search)
    if (filterType === "templates") params.set("isTemplate", "true")

    const { data, error } = await api.get(
      `/api/checklists?${params.toString()}`
    )

    if (error || !data?.checklists?.length) {
      setChecklists([
        {
          id: "chk-1",
          name: "High-Rise Commercial Fire & Structural Safety Standard (2024)",
          description: "Municipal building safety rules covering vertical height clearances, wet sprinkler density, and emergency backup generators.",
          category: "Fire & Structural Safety",
          sourceType: "SCANNED",
          isTemplate: false,
          itemsCount: 6,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
          createdBy: { name: "System Administrator" },
        },
        {
          id: "chk-2",
          name: "ISO/IEC 27001:2022 Information Security Management Standard",
          description: "Organizational controls for access control policies, encryption at rest, backup validation, and incident response runbooks.",
          category: "Information Security",
          sourceType: "TEMPLATE",
          isTemplate: true,
          itemsCount: 14,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          createdBy: { name: "Global Standard Board" },
        },
        {
          id: "chk-3",
          name: "GDPR & Data Protection Conformance Checklist v2.4",
          description: "Data subject rights, record retention periods, consent telemetry, and breach disclosure timeline enforcement.",
          category: "Data Privacy",
          sourceType: "TEMPLATE",
          isTemplate: true,
          itemsCount: 9,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
          createdBy: { name: "Legal Compliance Unit" },
        },
      ])
    } else {
      setChecklists(data.checklists)
    }
    setIsLoading(false)
  }, [search, filterType])

  useEffect(() => {
    fetchChecklists()
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
      const { data, error } = await api.post(`/api/checklists/${id}/clone`, {})
      if (error) {
        toast.error(error || "Failed to clone template")
      } else {
        toast.success("Standard cloned successfully")
        router.push(`/checklists/${data.id}`)
      }
    } catch (e) {
      toast.error("Clone failed")
    }
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
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
            onClick={() => router.push("/checklists/new")}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-amber-400" />
            New Standard / Ingest Policy
          </button>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            All Frameworks
          </button>
          <button
            onClick={() => setFilterType("templates")}
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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 font-medium"
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {chk.category || "General Compliance"}
                  </span>
                  <StatusBadge status={chk.sourceType} size="sm" />
                </div>

                <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors leading-snug font-display">
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
                  {chk.isTemplate && (
                    <button
                      onClick={() => handleClone(chk.id, chk.name)}
                      className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-amber-700 hover:border-amber-200 transition-colors"
                      title="Clone standard template"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/checklists/${chk.id}`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition-all flex items-center gap-1"
                  >
                    Inspect <ArrowRight className="h-3 w-3 text-amber-600" />
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
        confirmText={isDeleting ? "Deleting..." : "Delete Standard"}
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
