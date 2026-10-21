"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import {
    ArrowRight,
    BarChart,
    CheckSquare,
    Clock,
    FileText,
    Search,
    Users,
    X
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

interface SearchResult {
  id: string
  label: string
  sublabel?: string
  href: string
  category: "documents" | "checklists" | "reports" | "users" | "nav"
}

const NAV_COMMANDS: SearchResult[] = [
  { id: "nav-dashboard", label: "Go to Dashboard", href: "/dashboard", category: "nav" },
  { id: "nav-documents", label: "Go to Documents", href: "/documents", category: "nav" },
  { id: "nav-checklists", label: "Go to Checklists", href: "/checklists", category: "nav" },
  { id: "nav-reports", label: "Go to Reports", href: "/reports", category: "nav" },
  { id: "nav-auditlog", label: "Go to Audit Log", href: "/audit-log", category: "nav" },
  { id: "nav-notifications", label: "Go to Notifications", href: "/notifications", category: "nav" },
  { id: "nav-settings", label: "Go to Settings", href: "/settings", category: "nav" },
]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  documents: <FileText className="h-4 w-4" />,
  checklists: <CheckSquare className="h-4 w-4" />,
  reports: <BarChart className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  nav: <ArrowRight className="h-4 w-4" />,
}

const CATEGORY_LABELS: Record<string, string> = {
  documents: "Documents",
  checklists: "Checklists",
  reports: "Reports",
  users: "Users",
  nav: "Navigation",
}

const RECENT_KEY = "cmd_palette_recent"

function getRecent(): SearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
  } catch {
    return []
  }
}

function saveRecent(item: SearchResult) {
  try {
    const existing = getRecent().filter((r) => r.id !== item.id)
    const updated = [item, ...existing].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  } catch {}
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [recent, setRecent] = useState<SearchResult[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load recent on open
  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) { setRecent(getRecent()); setQuery(""); setResults([]); setActiveIdx(0); inputRef.current?.focus() }
    }, 0)
    return () => clearTimeout(timer)
  }, [open])

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) return

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const q = encodeURIComponent(query.trim())

      const [docRes, checkRes, repRes, userRes] = await Promise.all([
        api.get<{ documents: Array<{ id: string; name: string; status: string }> }>(`/api/documents?search=${q}&limit=5`),
        api.get<{ checklists: Array<{ id: string; name: string; category: string }> }>(`/api/checklists?search=${q}&limit=5`),
        api.get<{ items: Array<{ id: string; name: string; status: string }> }>(`/api/reports?limit=20`), // no search param on reports, filter client-side
        isAdmin ? api.get<{ users: Array<{ id: string; name: string; email: string; role: string }> }>(`/api/admin/users?search=${q}&limit=5`) : Promise.resolve({ data: null }),
      ])

      const found: SearchResult[] = []

      if (docRes.data?.documents) {
        docRes.data.documents.forEach((d) => {
          found.push({ id: `doc-${d.id}`, label: d.name, sublabel: d.status, href: `/documents/${d.id}`, category: "documents" })
        })
      }
      if (checkRes.data?.checklists) {
        checkRes.data.checklists.forEach((c) => {
          found.push({ id: `chk-${c.id}`, label: c.name, sublabel: c.category, href: `/checklists/${c.id}`, category: "checklists" })
        })
      }
      if (repRes.data?.items) {
        const q_lower = query.toLowerCase()
        repRes.data.items
          .filter((r) => r.name.toLowerCase().includes(q_lower))
          .slice(0, 5)
          .forEach((r) => {
            found.push({ id: `rep-${r.id}`, label: r.name, sublabel: r.status, href: `/reports/${r.id}`, category: "reports" })
          })
      }
      if (userRes.data?.users) {
        userRes.data.users.forEach((u) => {
          found.push({ id: `usr-${u.id}`, label: u.name, sublabel: u.email, href: `/admin/users`, category: "users" })
        })
      }

      // Add nav commands that match query
      const navMatches = NAV_COMMANDS.filter((n) =>
        n.label.toLowerCase().includes(query.toLowerCase())
      )

      setResults([...found, ...navMatches])
      setActiveIdx(0)
      setIsSearching(false)
    }, 200)

    return () => clearTimeout(timer)
  }, [query, isAdmin])

  const displayed = query.trim() ? results : recent.length ? recent : NAV_COMMANDS

  const navigate = useCallback(
    (item: SearchResult) => {
      saveRecent(item)
      setRecent(getRecent())
      router.push(item.href)
      onClose()
    },
    [router, onClose]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, displayed.length - 1))
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    }
    if (e.key === "Enter" && displayed[activeIdx]) {
      navigate(displayed[activeIdx])
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIdx])

  if (!open) return null

  // Group results by category for display
  const groups: Record<string, SearchResult[]> = {}
  displayed.forEach((item) => {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  })

  const isShowingRecent = !query.trim() && recent.length > 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        {/* Palette */}
        <div
          className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-focus)",
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <Search className="h-5 w-5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents, checklists, reports…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
              aria-label="Command palette search"
              role="combobox"
              aria-expanded={open}
              aria-controls="command-search-results"
              aria-autocomplete="list"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-1 rounded hover:bg-surface transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
              </button>
            )}
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded border font-mono"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-deep)",
                color: "var(--text-muted)",
              }}
            >
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <div className="max-h-80 overflow-y-auto" ref={listRef} role="listbox" id="command-search-results">
            {isSearching && (
              <div className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Searching…
              </div>
            )}

            {!isSearching && displayed.length === 0 && query.trim() && (
              <div className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {!isSearching && (
              <>
                {isShowingRecent && (
                  <div
                    className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Clock className="h-3 w-3" />
                    Recent
                  </div>
                )}
                {!query.trim() && !recent.length && (
                  <div
                    className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Navigation
                  </div>
                )}

                {/* Render grouped */}
                {Object.keys(groups).map((category) => (
                  <div key={category}>
                    {query.trim() && (
                      <div
                        className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {CATEGORY_LABELS[category]}
                      </div>
                    )}
                    {groups[category].map((item) => {
                      const globalIdx = displayed.indexOf(item)
                      const isActive = globalIdx === activeIdx
                      return (
                        <button
                          key={item.id}
                          role="option"
                          aria-selected={isActive}
                          onClick={() => navigate(item)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                          style={{
                            background: isActive ? "var(--glow-soft)" : "transparent",
                            color: "var(--text-primary)",
                            borderLeft: isActive ? "2px solid var(--green-500)" : "2px solid transparent",
                          }}
                          onMouseEnter={() => setActiveIdx(globalIdx)}
                        >
                          <span
                            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{
                              background: isActive ? "var(--green-900)" : "var(--bg-deep)",
                              color: isActive ? "var(--green-400)" : "var(--text-muted)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {CATEGORY_ICONS[item.category]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{item.label}</p>
                            {item.sublabel && (
                              <p
                                className="text-xs truncate mt-0.5"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {item.sublabel}
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div
            className="flex items-center gap-4 px-4 py-2 text-[10px]"
            style={{
              borderTop: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <span className="flex items-center gap-1">
              <kbd className="px-1 border rounded font-mono" style={{ borderColor: "var(--border)", background: "var(--bg-deep)" }}>↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 border rounded font-mono" style={{ borderColor: "var(--border)", background: "var(--bg-deep)" }}>↵</kbd> open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 border rounded font-mono" style={{ borderColor: "var(--border)", background: "var(--bg-deep)" }}>esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// Hook for global Cmd+K listener
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  return { open, setOpen }
}
