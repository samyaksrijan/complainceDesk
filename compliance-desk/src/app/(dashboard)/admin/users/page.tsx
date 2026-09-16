"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { usePageTitle } from "@/lib/use-page-title"
import { api } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import {
  UserPlus,
  Search,
  MoreVertical,
  Shield,
  UserX,
  UserCheck,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
  Copy,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  lastLoginAt: string | null
  documentCount: number
  checklistCount: number
}

interface UserStats {
  total: number
  active: number
  inactive: number
  byRole: { admin: number; auditor: number; viewer: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const date = new Date(dateStr)
  const diffMs = new Date().getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function InviteDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("VIEWER")
  const [tempPassword, setTempPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successData, setSuccessData] = useState<{ name: string; password: string } | null>(null)

  useEffect(() => {
    if (open) {
      setName("")
      setEmail("")
      setRole("VIEWER")
      setTempPassword(Math.random().toString(36).slice(-10) + "A1!")
      setError("")
      setSuccessData(null)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!name || !email) {
      setError("Name and email are required")
      return
    }
    setIsSubmitting(true)
    setError("")

    const { data, error: err } = await api.post("/api/admin/users", {
      name: name.trim(),
      email: email.trim(),
      role,
      temporaryPassword: tempPassword,
    })

    setIsSubmitting(false)

    if (err) {
      setError(err)
    } else {
      setSuccessData({ name: data.name, password: tempPassword })
      onSuccess()
    }
  }

  const copyPassword = () => {
    if (successData) {
      navigator.clipboard.writeText(successData.password)
      toast.success("Password copied to clipboard")
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
        
        {successData ? (
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(74, 222, 128, 0.1)", color: "var(--success)" }}>
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>User Invited Successfully</h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Share this temporary password securely with {successData.name}. They will be required to change it on their first login.
            </p>
            
            <div className="flex items-center gap-2 p-3 rounded-lg mb-6" style={{ background: "var(--bg-deep)", border: "1px solid var(--border)" }}>
              <code className="flex-1 font-mono text-sm text-left px-2" style={{ color: "var(--text-secondary)" }}>
                {successData.password}
              </code>
              <button
                onClick={copyPassword}
                className="p-2 rounded hover:bg-white/10 transition-colors"
                style={{ color: "var(--text-muted)" }}
                title="Copy password"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: "var(--green-600)", color: "white" }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Invite User</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add a new member to the workspace.</p>
              </div>
              <button onClick={onClose} className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-white/10 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
                  style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--green-500)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--glow-green)" }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
                  style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--green-500)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--glow-green)" }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="VIEWER">Viewer (Read-only)</option>
                  <option value="AUDITOR">Auditor (Edit & Scan)</option>
                  <option value="ADMIN">Admin (Full Access)</option>
                </select>
              </div>

              {error && (
                <p className="text-xs" style={{ color: "var(--error)" }}>{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !name || !email}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40"
                style={{ background: "var(--green-600)", color: "white" }}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Inviting..." : "Invite User"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EditRoleDialog({ 
  user, 
  open, 
  onClose, 
  onSuccess 
}: { 
  user: AdminUser | null; 
  open: boolean; 
  onClose: () => void; 
  onSuccess: () => void 
}) {
  const [role, setRole] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && user) setRole(user.role)
  }, [open, user])

  const handleSubmit = async () => {
    if (!user) return
    setIsSubmitting(true)
    const { error } = await api.put(`/api/admin/users/${user.id}/role`, { role })
    setIsSubmitting(false)

    if (error) {
      toast.error(error)
    } else {
      toast.success(`Role updated to ${role}`)
      onSuccess()
      onClose()
    }
  }

  if (!open || !user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Edit Role</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Change permissions for {user.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-white/10 transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
              style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <option value="VIEWER">Viewer</option>
              <option value="AUDITOR">Auditor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="flex gap-3 p-3 rounded-lg" style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
            <p className="text-xs leading-relaxed" style={{ color: "var(--warning)" }}>
              Changing a user's role will immediately affect their access permissions across the entire workspace.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || role === user.role}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40"
            style={{ background: "var(--green-600)", color: "white" }}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Saving..." : "Save Role"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const { user: currentUser, isAdmin } = useAuth()
  usePageTitle("User Management")
  
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  
  const [isLoading, setIsLoading] = useState(true)
  
  // Dialog states
  const [showInvite, setShowInvite] = useState(false)
  const [roleUser, setRoleUser] = useState<AdminUser | null>(null)
  const [deactivateUser, setDeactivateUser] = useState<AdminUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)

  const fetchData = useCallback(async () => {
    if (!isAdmin) return
    setIsLoading(true)
    
    const [statsRes, usersRes] = await Promise.all([
      api.get("/api/admin/users/stats"),
      api.get(`/api/admin/users?page=${page}&limit=${limit}&search=${search}&role=${roleFilter}&status=${statusFilter}`)
    ])
    
    if (statsRes.data) setStats(statsRes.data)
    if (usersRes.data) {
      setUsers(usersRes.data.users || [])
      setTotal(usersRes.data.total || 0)
      setTotalPages(usersRes.data.totalPages || 1)
    }
    
    setIsLoading(false)
  }, [isAdmin, page, limit, search, roleFilter, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleDeactivate = async () => {
    if (!deactivateUser) return
    const newStatus = deactivateUser.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    const { error } = await api.put(`/api/admin/users/${deactivateUser.id}/status`, { status: newStatus })
    if (error) {
      toast.error(error)
    } else {
      toast.success(`User ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`)
      fetchData()
    }
    setDeactivateUser(null)
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    const { error } = await api.delete(`/api/admin/users/${deleteUser.id}`)
    if (error) {
      toast.error(error)
    } else {
      toast.success("User deleted")
      fetchData()
    }
    setDeleteUser(null)
  }

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const allMenus = document.querySelectorAll('.user-action-menu')
    allMenus.forEach(m => {
      if (m.id !== `menu-${id}`) (m as HTMLElement).style.display = 'none'
    })
    const menu = document.getElementById(`menu-${id}`)
    if (menu) {
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
    }
  }

  // Close menus when clicking outside
  useEffect(() => {
    const closeMenus = () => {
      document.querySelectorAll('.user-action-menu').forEach(m => {
        (m as HTMLElement).style.display = 'none'
      })
    }
    window.addEventListener('click', closeMenus)
    return () => window.removeEventListener('click', closeMenus)
  }, [])

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in max-w-md mx-auto">
        <div className="h-16 w-16 rounded-full flex items-center justify-center mb-6" style={{ background: "rgba(248, 113, 113, 0.1)", border: "1px solid rgba(248, 113, 113, 0.2)" }}>
          <AlertTriangle className="h-8 w-8" style={{ color: "var(--error)" }} />
        </div>
        <h1 className="text-2xl font-display font-bold mb-3" style={{ color: "var(--text-primary)" }}>Access Denied</h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          You do not have permission to access the User Management page. Only administrators can view this area.
        </p>
      </div>
    )
  }

  const hasFilters = !!(search || roleFilter || statusFilter)

  return (
    <div className="animate-fade-up pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            User Management
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Manage accounts, roles, and access
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg"
          style={{ background: "var(--green-600)", color: "white" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--green-500)"; e.currentTarget.style.boxShadow = "0 4px 12px var(--glow-green)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--green-600)"; e.currentTarget.style.boxShadow = "none" }}
        >
          <UserPlus className="h-4 w-4" />
          Invite User
        </button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex gap-4 mb-6 overflow-x-auto pb-2 custom-scrollbar">
          <div className="px-4 py-3 rounded-lg flex items-center gap-3 min-w-[140px]" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5"><UserPlus className="h-4 w-4" style={{ color: "var(--text-muted)" }}/></div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total Users</p>
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.total}</p>
            </div>
          </div>
          <div className="px-4 py-3 rounded-lg flex items-center gap-3 min-w-[140px]" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--success)", boxShadow: "0 0 8px var(--success)" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Active</p>
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.active}</p>
            </div>
          </div>
          <div className="px-4 py-3 rounded-lg flex items-center gap-3 min-w-[140px]" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--text-muted)" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Inactive</p>
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.inactive}</p>
            </div>
          </div>
          <div className="w-px h-10 mx-2 self-center" style={{ background: "var(--border)" }} />
          <div className="px-4 py-3 rounded-lg flex flex-col justify-center min-w-[100px]" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Admins</p>
            <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{stats.byRole.admin}</p>
          </div>
          <div className="px-4 py-3 rounded-lg flex flex-col justify-center min-w-[100px]" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Auditors</p>
            <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{stats.byRole.auditor}</p>
          </div>
          <div className="px-4 py-3 rounded-lg flex flex-col justify-center min-w-[100px]" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Viewers</p>
            <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{stats.byRole.viewer}</p>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="sticky top-0 z-10 rounded-xl px-5 py-4 mb-6 flex items-center gap-3 flex-wrap" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search users by name or email…"
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all duration-200"
            style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--green-500)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--glow-green)" }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: roleFilter ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admins</option>
          <option value="AUDITOR">Auditors</option>
          <option value="VIEWER">Viewers</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: statusFilter ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearchInput(""); setSearch(""); setRoleFilter(""); setStatusFilter(""); setPage(1) }}
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

      {/* Data Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "1fr 100px 100px 140px 120px 100px 50px", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
          <span>User</span>
          <span>Role</span>
          <span>Status</span>
          <span>Activity</span>
          <span>Last Login</span>
          <span>Joined</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="grid gap-4 px-5 py-4 items-center" style={{ gridTemplateColumns: "1fr 100px 100px 140px 120px 100px 50px", borderBottom: "1px solid var(--border)" }}>
              {[...Array(7)].map((_, j) => <div key={j} className="h-4 rounded animate-shimmer-green" style={{ animationDelay: `${j * 0.05}s` }} />)}
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center">
            <UserX className="h-10 w-10 mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>{hasFilters ? "No users match your filters" : "No users found"}</p>
            {hasFilters && (
              <button onClick={() => { setSearchInput(""); setSearch(""); setRoleFilter(""); setStatusFilter(""); setPage(1) }} className="mt-4 px-4 py-2 rounded-lg text-sm transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          users.map((u, idx) => {
            const isSelf = u.id === currentUser?.id
            const isInactive = u.status === "INACTIVE"
            const isEvenRow = idx % 2 === 0
            
            return (
              <div key={u.id} className="grid gap-4 px-5 py-3.5 items-center transition-colors relative" style={{ gridTemplateColumns: "1fr 100px 100px 140px 120px 100px 50px", borderBottom: "1px solid var(--border)", background: isEvenRow ? "transparent" : "rgba(255,255,255,0.01)", opacity: isInactive ? 0.6 : 1 }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glow-soft)")} onMouseLeave={(e) => (e.currentTarget.style.background = isEvenRow ? "transparent" : "rgba(255,255,255,0.01)")}>
                
                {/* User Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "var(--bg-deep)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    {getInitials(u.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-2" style={{ color: "var(--text-primary)", textDecoration: isInactive ? "line-through" : "none" }}>
                      {u.name}
                      {isSelf && <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--green-900)", color: "var(--green-400)" }}>(You)</span>}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                  </div>
                </div>

                {/* Role */}
                <div><StatusBadge status={u.role} size="sm" /></div>

                {/* Status */}
                <div>
                  <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-full flex items-center gap-1.5 w-max" style={{ background: isInactive ? "var(--bg-deep)" : "rgba(74, 222, 128, 0.1)", color: isInactive ? "var(--text-muted)" : "var(--success)", border: `1px solid ${isInactive ? "var(--border)" : "rgba(74, 222, 128, 0.2)"}` }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: isInactive ? "var(--text-muted)" : "var(--success)" }} />
                    {u.status}
                  </span>
                </div>

                {/* Activity */}
                <div>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{u.documentCount} doc{u.documentCount !== 1 ? 's' : ''}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{u.checklistCount} list{u.checklistCount !== 1 ? 's' : ''}</p>
                </div>

                {/* Last Login */}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(u.lastLoginAt)}</span>
                
                {/* Joined */}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(u.createdAt)}</span>

                {/* Actions Dropdown */}
                <div className="relative text-right">
                  <button onClick={(e) => toggleMenu(e, u.id)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" style={{ color: "var(--text-muted)" }}>
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  
                  <div id={`menu-${u.id}`} className="user-action-menu hidden absolute right-0 top-8 w-40 rounded-lg shadow-xl z-20 py-1" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    {isSelf ? (
                      <div className="px-3 py-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                        Use Settings to manage your own account.
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setRoleUser(u)} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
                          <Shield className="h-3.5 w-3.5" /> Edit Role
                        </button>
                        <button onClick={() => setDeactivateUser(u)} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-white/5 transition-colors" style={{ color: "var(--warning)" }}>
                          <UserX className="h-3.5 w-3.5" /> {isInactive ? "Activate" : "Deactivate"}
                        </button>
                        <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                        <button onClick={() => setDeleteUser(u)} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-white/5 transition-colors" style={{ color: "var(--error)" }}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete User
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} users
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Previous</button>
            <span className="px-3 text-sm" style={{ color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Next</button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <InviteDialog open={showInvite} onClose={() => setShowInvite(false)} onSuccess={() => { fetchData() }} />
      <EditRoleDialog open={!!roleUser} user={roleUser} onClose={() => setRoleUser(null)} onSuccess={() => fetchData()} />
      
      <ConfirmDialog
        open={!!deactivateUser}
        onOpenChange={(open) => !open && setDeactivateUser(null)}
        title={deactivateUser?.status === "ACTIVE" ? "Deactivate User" : "Activate User"}
        description={deactivateUser?.status === "ACTIVE" 
          ? `Are you sure you want to deactivate ${deactivateUser?.name}? They will not be able to log in.` 
          : `Reactivate ${deactivateUser?.name}? They will be able to log in again.`}
        confirmLabel={deactivateUser?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        onConfirm={handleDeactivate}
      />

      <ConfirmDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        title="Delete User"
        description={`Are you sure you want to delete ${deleteUser?.name}? This action cannot be undone. Their documents and audit history will be preserved.`}
        confirmLabel="Delete User"
        onConfirm={handleDelete}
      />
    </div>
  )
}
