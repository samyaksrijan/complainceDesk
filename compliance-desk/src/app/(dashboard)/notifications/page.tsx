"use client"

import {
    formatRelativeTime,
    notifIcon,
    notifIconBg,
    notifIconColor,
} from "@/components/notifications/notification-bell"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import { Bell, BookCheck, CheckCheck, Search, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  type: string
  title: string
  message: string
  actorName: string | null
  targetType: string | null
  targetId: string | null
  targetName: string | null
  read: boolean
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  ANALYSIS_COMPLETE: "Analysis Complete",
  ANALYSIS_FAILED: "Analysis Failed",
  DOCUMENT_UPLOADED: "Document Uploaded",
  DOCUMENT_DELETED: "Document Deleted",
  CHECKLIST_CREATED: "Checklist Created",
  CHECKLIST_UPDATED: "Checklist Updated",
  ROLE_CHANGED: "Role Changed",
  USER_INVITED: "User Invited",
  WEEKLY_DIGEST: "Weekly Digest",
  SYSTEM: "System",
}

function getNavTarget(n: Notification): string | null {
  if (!n.targetId) return null
  if (n.targetType === "DOCUMENT") return `/documents/${n.targetId}`
  if (n.targetType === "CHECKLIST") return `/checklists/${n.targetId}`
  return null
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter()
  usePageTitle("Notifications")
  const [items, setItems] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [typeFilter, setTypeFilter] = useState("")
  const [readStatus, setReadStatus] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "20")
    if (typeFilter) params.set("type", typeFilter)
    if (readStatus) params.set("readStatus", readStatus)
    if (search) params.set("search", search)

    const { data } = await api.get<{
      items: Notification[]
      total: number
      unreadCount: number
      totalPages: number
    }>(`/api/notifications?${params.toString()}`)

    if (data) {
      setItems(data.items)
      setTotal(data.total)
      setUnreadCount(data.unreadCount)
      setTotalPages(data.totalPages)
    }
    setIsLoading(false)
  }, [page, typeFilter, readStatus, search])

  useEffect(() => {
    void Promise.resolve().then(fetchData)
  }, [fetchData])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const markRead = async (n: Notification) => {
    if (!n.read) {
      const { error } = await api.put(`/api/notifications/${n.id}/read`)
      if (error) { toast.error(error); return }
      setItems((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    const nav = getNavTarget(n)
    if (nav) router.push(nav)
  }

  const dismiss = async (id: string) => {
    const { error } = await api.delete(`/api/notifications/${id}`)
    if (error) { toast.error(error); return }
    const removed = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1))
    toast.success("Notification dismissed")
  }

  const markAllRead = async () => {
    if (unreadCount === 0) return
    const { error } = await api.put("/api/notifications/mark-all-read")
    if (error) { toast.error(error); return }
    setItems((prev) => prev.map((i) => ({ ...i, read: true })))
    setUnreadCount(0)
    toast.success("All notifications marked as read")
  }

  const clearFilters = () => {
    setTypeFilter("")
    setReadStatus("")
    setSearchInput("")
    setSearch("")
    setPage(1)
  }

  const hasFilters = !!(typeFilter || readStatus || search)

  return (
    <div className="animate-fade-up pb-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Notifications
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Stay informed about activity across your workspace
          </p>
        </div>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-30"
          style={{ border: "1px solid var(--border)", color: "var(--green-400)" }}
        >
          <CheckCheck className="h-4 w-4" />
          Mark all as read {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {/* Filter bar */}
      <div
        className="sticky top-0 z-10 rounded-xl px-5 py-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", backdropFilter: "blur(12px)" }}
      >
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search notifications…"
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all duration-200"
            style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--green-500)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--glow-green)" }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: typeFilter ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        <select
          value={readStatus}
          onChange={(e) => { setReadStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: readStatus ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          <option value="">All</option>
          <option value="UNREAD">Unread</option>
          <option value="READ">Read</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--error)"; e.currentTarget.style.borderColor = "var(--error)" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)" }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Notification cards */}
      <div className="space-y-2">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-5 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div className="h-10 w-10 rounded-xl animate-shimmer-green flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded animate-shimmer-green w-1/3" />
                <div className="h-3.5 rounded animate-shimmer-green w-full" />
                <div className="h-3 rounded animate-shimmer-green w-2/3" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full flex items-center justify-center mb-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <Bell className="h-8 w-8 opacity-20" style={{ color: "var(--text-muted)" }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              {hasFilters ? "No notifications match your filters" : "No notifications yet"}
            </h3>
            <p className="text-sm max-w-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {hasFilters
                ? "Try adjusting your search or filter criteria."
                : "You'll be notified about document analysis completions, checklist changes, role updates, and more."}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-5 px-4 py-2 rounded-lg text-sm transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className="group relative flex items-start gap-4 p-5 rounded-xl cursor-pointer transition-all duration-200"
              style={{
                background: n.read ? "var(--bg-surface)" : "rgba(74, 222, 128, 0.04)",
                border: `1px solid ${n.read ? "var(--border)" : "rgba(74, 222, 128, 0.2)"}`,
                borderLeft: n.read ? undefined : "3px solid var(--green-500)",
              }}
              onClick={() => markRead(n)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "var(--bg-surface)" : "rgba(74, 222, 128, 0.04)")}
            >
              {/* Unread indicator */}
              {!n.read && (
                <div className="absolute top-5 right-5 h-2 w-2 rounded-full" style={{ background: "#3b82f6", boxShadow: "0 0 6px rgba(59, 130, 246, 0.6)" }} />
              )}

              {/* Type icon */}
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: notifIconBg(n.type), color: notifIconColor(n.type) }}
              >
                {notifIcon(n.type, "h-5 w-5")}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 mb-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                      <span
                        className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                        style={{ background: notifIconBg(n.type), color: notifIconColor(n.type) }}
                      >
                        {TYPE_LABELS[n.type] || n.type}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{n.message}</p>
                    {n.targetName && (
                      <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                        Target: <span style={{ color: "var(--text-secondary)" }}>{n.targetName}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {n.actorName && (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>by {n.actorName}</span>
                  )}
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(n.createdAt)}</span>
                </div>
              </div>

              {/* Hover actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {!n.read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markRead(n) }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                    style={{ border: "1px solid var(--border)", color: "var(--green-400)" }}
                    title="Mark as read"
                  >
                    <BookCheck className="h-3 w-3" />
                    Read
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  title="Dismiss"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 flex-wrap gap-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} notifications
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Previous
            </button>
            <span className="px-3 text-sm" style={{ color: "var(--text-muted)" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
