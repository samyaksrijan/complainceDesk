"use client"

import { usePathname } from "next/navigation"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { CommandPalette, useCommandPalette } from "@/components/layout/command-palette"
import { Search, Menu } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

// Map paths to human-readable page names
function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard"
  if (pathname.startsWith("/documents") && pathname !== "/documents") return "Document Detail"
  if (pathname === "/documents") return "Documents"
  if (pathname.startsWith("/checklists/new")) return "Create Checklist"
  if (pathname.match(/\/checklists\/.+\/edit/)) return "Edit Checklist"
  if (pathname.match(/\/checklists\/.+/)) return "Checklist Detail"
  if (pathname === "/checklists") return "Checklists"
  if (pathname === "/audit-log") return "Audit Log"
  if (pathname === "/settings") return "Settings"
  if (pathname === "/admin/users") return "User Management"
  if (pathname === "/notifications") return "Notifications"
  if (pathname.startsWith("/reports") && pathname !== "/reports") return "Report Detail"
  if (pathname === "/reports") return "Reports"
  return ""
}

export function DashboardHeader() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const { open, setOpen } = useCommandPalette()

  return (
    <>
      <header
        className="flex items-center justify-between px-8 py-3 flex-shrink-0"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-deep)",
          backdropFilter: "blur(12px)",
          minHeight: "56px",
        }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <button 
                className="lg:hidden p-1.5 -ml-1.5 rounded-md hover:bg-surface text-text-muted transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-elevated border-r border-border [&>button]:hidden">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <Sidebar />
            </SheetContent>
          </Sheet>

          {/* Breadcrumb / Page title */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium hidden sm:inline-block" style={{ color: "var(--text-muted)" }}>
              Compliance Desk
            </span>
            {title && (
              <>
                <span className="hidden sm:inline-block" style={{ color: "var(--border)" }}>/</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {title}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Cmd+K Search Button */}
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-focus)"
              e.currentTarget.style.color = "var(--text-secondary)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)"
              e.currentTarget.style.color = "var(--text-muted)"
            }}
            aria-label="Open command palette (Ctrl+K)"
            title="Command Palette (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search…</span>
            <kbd
              className="hidden sm:inline px-1 rounded text-[10px] font-mono"
              style={{
                background: "var(--bg-deep)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              ⌘K
            </kbd>
          </button>

          <NotificationBell />
        </div>
      </header>

      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  )
}
