"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { signOut } from "next-auth/react";
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  BarChart, 
  Users, 
  Settings, 
  LogOut,
  ClipboardList,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, isAuditor } = useAuth();

  const routes = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      active: pathname === "/dashboard",
      show: true,
    },
    {
      label: "Documents",
      icon: FileText,
      href: "/documents",
      active: pathname.startsWith("/documents"),
      show: true,
    },
    {
      label: "Checklists",
      icon: CheckSquare,
      href: "/checklists",
      active: pathname.startsWith("/checklists"),
      show: true,
    },
    {
      label: "Reports",
      icon: BarChart,
      href: "/reports",
      active: pathname.startsWith("/reports"),
      show: true,
    },
    {
      label: "Audit Log",
      icon: ClipboardList,
      href: "/audit-log",
      active: pathname.startsWith("/audit-log"),
      show: isAdmin || isAuditor,
    },
    {
      label: "Notifications",
      icon: Bell,
      href: "/notifications",
      active: pathname.startsWith("/notifications"),
      show: true,
    },
    {
      label: "User Management",
      icon: Users,
      href: "/admin/users",
      active: pathname.startsWith("/admin/users"),
      show: isAdmin,
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/settings",
      active: pathname.startsWith("/settings"),
      show: true,
    },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-elevated border-r border-border text-primary-foreground">
      <div className="p-6">
        <h2 className="text-2xl font-display font-bold text-primary-foreground tracking-tight">
          Compliance Desk
        </h2>
      </div>
      
      <div className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {routes.filter(r => r.show).map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              route.active 
                ? "bg-green-900/30 text-green-400 border border-green-900/50" 
                : "text-text-secondary hover:bg-surface hover:text-text-primary"
            )}
          >
            <route.icon className={cn("h-4 w-4", route.active ? "text-green-400" : "text-text-muted")} />
            {route.label}
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-surface">
        <div className="flex flex-col gap-1 mb-4 px-2">
          <p className="text-sm font-medium text-text-primary truncate">{user?.name}</p>
          <p className="text-xs text-text-muted truncate">{user?.email}</p>
          <div className="mt-1">
            <span className={cn(
              "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
              isAdmin ? "bg-green-900 text-green-300" : 
              isAuditor ? "bg-blue-900/30 text-blue-400" : 
              "bg-gray-800 text-gray-400"
            )}>
              {user?.role}
            </span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-text-secondary hover:text-text-primary hover:bg-elevated"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );
}
