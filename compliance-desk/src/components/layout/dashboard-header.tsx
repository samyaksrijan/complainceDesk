"use client"

import { CommandPalette, useCommandPalette } from "@/components/layout/command-palette"
import { Sidebar } from "@/components/layout/sidebar"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Search } from "lucide-react"
import { useState } from "react"
import { usePathname } from "next/navigation"

// Map paths to human-readable page names
function getPageTitle(pathname: string): { section: string; title: string } {
  if (pathname === "/dashboard") return { section: "Governance", title: "Overview Dashboard" }
  if (pathname.startsWith("/documents") && pathname !== "/documents") return { section: "Audit Documents", title: "Evidence Verification Studio" }
  if (pathname === "/documents") return { section: "Audit Documents", title: "Document Repository" }
  if (pathname.startsWith("/checklists/new")) return { section: "Compliance Standards", title: "Rule Builder & Policy Ingestion" }
  if (pathname.match(/\/checklists\/.+\/edit/)) return { section: "Compliance Standards", title: "Edit Checklist Criteria" }
  if (pathname.match(/\/checklists\/.+/)) return { section: "Compliance Standards", title: "Standard Specification" }
  if (pathname === "/checklists") return { section: "Compliance Standards", title: "Regulatory Checklists" }
  if (pathname === "/audit-log") return { section: "Governance", title: "Immutable Audit Trail" }
  if (pathname === "/settings") return { section: "Configuration", title: "System Preferences" }
  if (pathname === "/admin/users") return { section: "Organization", title: "User Governance & Access" }
  if (pathname === "/notifications") return { section: "Governance", title: "System Alerts & Activity" }
  if (pathname.startsWith("/reports") && pathname !== "/reports") return { section: "Executive Reports", title: "Compliance Audit Certificate" }
  if (pathname === "/reports") return { section: "Executive Reports", title: "Compliance Reports" }
  return { section: "Workspace", title: "Compliance Desk" }
}

export function DashboardHeader() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { section, title } = getPageTitle(pathname)
  const { open, setOpen } = useCommandPalette()

  return (
    <>
      <header
        className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-md min-h-[56px] font-sans"
      >
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button 
                className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors border border-transparent hover:border-slate-200"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-white border-r border-slate-200" onClickCapture={event => { if (event.target instanceof Element && event.target.closest("a")) setMobileOpen(false) }}>
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Navigate between your organization’s compliance modules.</SheetDescription>
              <Sidebar />
            </SheetContent>
          </Sheet>

          {/* Breadcrumb / Page title */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium hidden sm:inline-block">
              {section}
            </span>
            <span className="text-slate-300 hidden sm:inline-block">/</span>
            <span className="font-bold text-slate-900 tracking-tight font-display">
              {title}
            </span>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2.5">
          {/* Cmd+K Search Button */}
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all bg-slate-50 border border-slate-200 text-slate-500 hover:border-brand-500/50 hover:text-slate-900 shadow-sm"
            aria-label="Open command palette (Ctrl+K)"
            title="Command Palette (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">Search regulations, audits, criteria…</span>
            <kbd
              className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-500 font-semibold"
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
