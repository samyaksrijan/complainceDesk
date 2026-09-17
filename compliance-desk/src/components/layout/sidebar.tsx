"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { signOut } from "next-auth/react";
import { 
  LayoutDashboard, 
  FileText, 
  ShieldCheck, 
  BarChart3, 
  Users, 
  Settings, 
  LogOut,
  ScrollText,
  Bell,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, isAuditor } = useAuth();

  const routes = [
    {
      label: "Overview",
      icon: LayoutDashboard,
      href: "/dashboard",
      active: pathname === "/dashboard",
      show: true,
      tag: null,
    },
    {
      label: "Audit Documents",
      icon: FileText,
      href: "/documents",
      active: pathname.startsWith("/documents"),
      show: true,
      tag: null,
    },
    {
      label: "Compliance Standards",
      icon: ShieldCheck,
      href: "/checklists",
      active: pathname.startsWith("/checklists"),
      show: true,
      tag: null,
    },
    {
      label: "Executive Reports",
      icon: BarChart3,
      href: "/reports",
      active: pathname.startsWith("/reports"),
      show: true,
      tag: null,
    },
    {
      label: "Audit Trail",
      icon: ScrollText,
      href: "/audit-log",
      active: pathname.startsWith("/audit-log"),
      show: isAdmin || isAuditor,
      tag: null,
    },
    {
      label: "System Alerts",
      icon: Bell,
      href: "/notifications",
      active: pathname.startsWith("/notifications"),
      show: true,
      tag: null,
    },
    {
      label: "User Governance",
      icon: Users,
      href: "/admin/users",
      active: pathname.startsWith("/admin/users"),
      show: isAdmin,
      tag: "Admin",
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/settings",
      active: pathname.startsWith("/settings"),
      show: true,
      tag: null,
    },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-slate-200 text-slate-900 font-sans">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-sm">
            <ShieldCheck className="h-5 w-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight font-display">
              Compliance Desk
            </h2>
            <p className="text-[10px] uppercase font-bold tracking-wider text-amber-600">
              Enterprise Governance
            </p>
          </div>
        </Link>
      </div>
      
      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Core Modules
        </div>
        {routes.filter(r => r.show).map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all group",
              route.active 
                ? "bg-slate-100 text-slate-900 border border-slate-200 shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <div className="flex items-center gap-3">
              <route.icon className={cn(
                "h-4 w-4 transition-colors", 
                route.active ? "text-amber-600" : "text-slate-400 group-hover:text-slate-700"
              )} />
              <span>{route.label}</span>
            </div>
            {route.tag && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                {route.tag}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* User Governance Pill & Session */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="rounded-xl p-3 bg-white border border-slate-200 shadow-sm mb-2">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-xs font-bold text-slate-900 truncate font-display">{user?.name || "Governance Officer"}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <span className={cn(
              "text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border",
              isAdmin ? "bg-amber-50 text-amber-700 border-amber-200" : 
              isAuditor ? "bg-sky-50 text-sky-700 border-sky-200" : 
              "bg-slate-100 text-slate-600 border-slate-200"
            )}>
              {isAdmin ? "Admin" : isAuditor ? "Auditor" : "Viewer"}
            </span>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full justify-start text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 h-8 rounded-lg"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-3.5 w-3.5 text-slate-400" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
