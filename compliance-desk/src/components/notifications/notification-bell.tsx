"use client"

import { toast } from "sonner"

import { api } from "@/lib/api"
import {
    ArrowRight,
    Bell,
    CalendarDays,
    CheckCheck,
    Info,
    ListFilter,
    ListPlus,
    ShieldCheck,
    ShieldX,
    Trash2,
    Upload,
    UserCog,
    UserPlus,
    WifiOff,
    X
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function notifIcon(type: string, className = "h-4 w-4") {
  const map: Record<string, React.ReactNode> = {
    ANALYSIS_COMPLETE: <ShieldCheck className={className} />,
    ANALYSIS_FAILED: <ShieldX className={className} />,
    DOCUMENT_UPLOADED: <Upload className={className} />,
    DOCUMENT_DELETED: <Trash2 className={className} />,
    CHECKLIST_CREATED: <ListPlus className={className} />,
    CHECKLIST_UPDATED: <ListFilter className={className} />,
    ROLE_CHANGED: <UserCog className={className} />,
    USER_INVITED: <UserPlus className={className} />,
    WEEKLY_DIGEST: <CalendarDays className={className} />,
    SYSTEM: <Info className={className} />,
  }
  return map[type] ?? <Info className={className} />
}

export function notifIconColor(type: string): string {
  if (type === "ANALYSIS_COMPLETE") return "var(--success)"
  if (type === "ANALYSIS_FAILED") return "var(--error)"
  if (type.startsWith("DOCUMENT")) return "var(--blue-400)"
  if (type.startsWith("CHECKLIST")) return "var(--green-400)"
  if (type === "ROLE_CHANGED" || type === "USER_INVITED") return "#a78bfa"
  if (type === "WEEKLY_DIGEST") return "var(--warning)"
  return "var(--text-muted)"
}

export function notifIconBg(type: string): string {
  if (type === "ANALYSIS_COMPLETE") return "rgba(74, 222, 128, 0.1)"
  if (type === "ANALYSIS_FAILED") return "rgba(248, 113, 113, 0.1)"
  if (type.startsWith("DOCUMENT")) return "rgba(96, 165, 250, 0.1)"
  if (type.startsWith("CHECKLIST")) return "rgba(74, 222, 128, 0.08)"
  if (type === "ROLE_CHANGED" || type === "USER_INVITED") return "rgba(167, 139, 250, 0.1)"
  if (type === "WEEKLY_DIGEST") return "rgba(245, 158, 11, 0.1)"
  return "rgba(255,255,255,0.06)"
}

export function formatRelativeTime(dateStr: string): string {
  const ms = new Date().getTime() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function getNavTarget(n: Notification): string | null {
  if (!n.targetId) return null
  if (n.targetType === "DOCUMENT") return `/documents/${n.targetId}`
  if (n.targetType === "CHECKLIST") return `/checklists/${n.targetId}`
  return null
}

// ─── Main Bell Dropdown Component ─────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  // Poll unread count every 30s
  const fetchUnreadCount = useCallback(async () => {
    const { data } = await api.get<{ count: number }>("/api/notifications/unread-count")
    if (data !== null) setUnreadCount(data.count)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(fetchUnreadCount)
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Fetch notifications when dropdown opens
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    setFetchError(false)
    const params = filter === "UNREAD" ? "?unreadOnly=true&limit=20" : "?limit=20"
    const { data, error } = await api.get<{ items: Notification[]; unreadCount: number }>(
      `/api/notifications${params}`
    )
    setIsLoading(false)
    if (error) {
      setFetchError(true)
    } else if (data) {
      setItems(data.items)
      setUnreadCount(data.unreadCount)
    }
  }, [filter])

  useEffect(() => {
    if (open) void Promise.resolve().then(fetchNotifications)
  }, [open, fetchNotifications])

  // Close on Escape or outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    const onOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !bellRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onOutside)
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onOutside) }
  }, [])

  const markRead = async (n: Notification) => {
    if (!n.read) {
      const { error } = await api.put(`/api/notifications/${n.id}/read`)
      if (error) { toast.error(error); return }
      setItems((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    const nav = getNavTarget(n)
    if (nav) { router.push(nav); setOpen(false) }
  }

  const dismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const { error } = await api.delete(`/api/notifications/${id}`)
    if (error) { toast.error(error); return }
    const removed = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1))
  }

  const markAllRead = async () => {
    const unreadItems = items.filter((i) => !i.read)
    if (unreadItems.length === 0) return
    const { error } = await api.put("/api/notifications/mark-all-read")
    if (error) { toast.error(error); return }
    setItems((prev) => prev.map((i) => ({ ...i, read: true })))
    setUnreadCount(0)
  }

  const displayedItems = filter === "UNREAD" ? items.filter((i) => !i.read) : items

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg transition-all duration-200"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; e.currentTarget.style.color = "var(--text-primary)" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full text-[9px] font-bold px-1"
            style={{ background: "#ef4444", color: "white", boxShadow: "0 0 6px rgba(239, 68, 68, 0.6)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-10 w-80 rounded-xl shadow-2xl z-50 animate-in slide-in-from-top-2 fade-in duration-150 overflow-hidden"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</span>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-xs disabled:opacity-30 transition-colors flex items-center gap-1"
              style={{ color: "var(--green-400)" }}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            {(["ALL", "UNREAD"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all duration-150"
                style={{
                  background: filter === f ? "var(--green-600)" : "var(--bg-deep)",
                  color: filter === f ? "white" : "var(--text-muted)",
                }}
              >
                {f === "UNREAD" ? `Unread ${unreadCount > 0 ? `(${unreadCount})` : ""}` : "All"}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto" style={{ maxHeight: "340px" }}>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="h-8 w-8 rounded-lg animate-shimmer-green flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded animate-shimmer-green w-3/4" />
                    <div className="h-2.5 rounded animate-shimmer-green w-full" />
                  </div>
                </div>
              ))
            ) : fetchError ? (
              <div className="py-8 text-center px-4">
                <WifiOff className="h-6 w-6 mx-auto mb-2 opacity-30" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Failed to load notifications.</p>
                <button onClick={fetchNotifications} className="text-xs mt-2" style={{ color: "var(--green-400)" }}>Retry</button>
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="py-10 text-center px-4">
                <Bell className="h-7 w-7 mx-auto mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>You&apos;re all caught up!</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No {filter === "UNREAD" ? "unread " : ""}notifications.</p>
              </div>
            ) : (
              displayedItems.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n)}
                  className="group flex items-start gap-3 px-4 py-3 cursor-pointer relative transition-colors"
                  style={{ borderBottom: "1px solid var(--border)", background: n.read ? "transparent" : "rgba(74, 222, 128, 0.03)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glow-soft)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "transparent" : "rgba(74, 222, 128, 0.03)")}
                >
                  {/* Unread indicator */}
                  {!n.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: "var(--green-500)" }} />
                  )}

                  {/* Type icon */}
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: notifIconBg(n.type), color: notifIconColor(n.type) }}
                  >
                    {notifIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                        {n.title}
                      </p>
                      <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {n.message}
                    </p>
                    {n.actorName && n.actorName !== "System" && (
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>by {n.actorName}</p>
                    )}
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={(e) => dismiss(e, n.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all flex-shrink-0"
                    style={{ color: "var(--text-muted)" }}
                    title="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 flex justify-center" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => { router.push("/notifications"); setOpen(false) }}
              className="text-xs flex items-center gap-1.5 transition-colors"
              style={{ color: "var(--green-400)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--green-300)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--green-400)")}
            >
              View all notifications
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
