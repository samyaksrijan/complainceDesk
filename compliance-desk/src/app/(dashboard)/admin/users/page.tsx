"use client"

import { PaginationControls } from "@/components/ui/pagination-controls"

import { useAuth } from "@/components/providers/auth-provider"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import {
    Search,
    Trash2,
    UserPlus
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  lastLoginAt: string | null
}

export default function AdminUsersPage() {
  usePageTitle("User Governance")
  const { user, isAdmin } = useAuth()

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  // Invite Form State
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("AUDITOR")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await api.get<{ users: AdminUser[]; total: number; totalPages: number }>(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`)

    if (error) toast.error(error)
    setUsers(data?.users || [])
    setTotalPages(data?.totalPages || 1)
    setTotal(data?.total || 0)
    setIsLoading(false)
  }, [page, search])

  useEffect(() => {
    void Promise.resolve().then(fetchUsers)
  }, [fetchUsers])

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const { error } = await api.post("/api/admin/users/invite", {
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
      })

      if (error) {
        toast.error(error)
      } else {
        toast.success(`Invitation provisioned for ${inviteEmail}`)
        setInviteOpen(false)
        setInviteName("")
        setInviteEmail("")
        fetchUsers()
      }
    } catch {
      toast.error("Failed to provision user")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    const { error } = await api.delete(`/api/admin/users/${deleteTarget.id}`)
    if (error) {
      toast.error(error)
    } else {
      toast.success("User removed from workspace")
      setDeleteTarget(null)
      fetchUsers()
    }
  }

  async function changeMember(id: string, field: "role" | "status", value: string) {
    const { error } = await api.put(`/api/admin/users/${id}/${field}`, { [field]: value })
    if (error) toast.error(error)
    else { toast.success("Member updated"); await fetchUsers() }
  }
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  if (!isAdmin) return <p className="p-6">Administrator access required.</p>

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
              Access Governance
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">
            User Governance & RBAC Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage organization members, assign role permissions, and provision secure access tokens.
          </p>
        </div>

        <div>
          <button
            onClick={() => setInviteOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer font-sans"
          >
            <UserPlus className="h-4 w-4 text-brand-400" />
            Provision New User
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search directory by name or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 font-medium"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono font-medium">
            {filteredUsers.length} Active Member{filteredUsers.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/60 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-3.5 px-4 font-display">Member Name</th>
                <th className="py-3.5 px-4 font-display">Role Permission</th>
                <th className="py-3.5 px-4 font-display">Account Status</th>
                <th className="py-3.5 px-4 hidden md:table-cell font-display">Last Active</th>
                <th className="py-3.5 px-4 text-right font-display">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-36" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="py-4 px-4 hidden md:table-cell"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 bg-slate-100 rounded w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{u.email}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <select aria-label={`Role for ${u.name}`} value={u.role} disabled={u.id === user?.id} onChange={e => changeMember(u.id, "role", e.target.value)} className="rounded-lg border bg-white p-1.5"><option value="ADMIN">Admin</option><option value="AUDITOR">Auditor</option><option value="VIEWER">Viewer</option></select>
                    </td>
                    <td className="py-3.5 px-4">
                      <select aria-label={`Status for ${u.name}`} value={u.status} disabled={u.id === user?.id} onChange={e => changeMember(u.id, "status", e.target.value)} className="rounded-lg border bg-white p-1.5"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px] font-mono hidden md:table-cell font-medium">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Pending login"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {u.email !== user?.email && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationControls page={page} totalPages={totalPages} total={total} onChange={setPage} />

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-200 text-slate-900 p-6 rounded-2xl shadow-xl font-sans">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
                <UserPlus className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-bold text-slate-900 tracking-tight font-display">
                Provision User Access
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Add a new member to your workspace with specific role permissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sarah Chen"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Corporate Email
              </label>
              <input
                type="email"
                placeholder="s.chen@apex.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Role Permission
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="ADMIN">Admin (Full administrative control)</option>
                <option value="AUDITOR">Auditor (Upload documents & run evaluations)</option>
                <option value="VIEWER">Viewer (Read-only observation)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Provisioning…" : "Provision Access"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Revoke Member Access"
        description={`Are you sure you want to revoke workspace access for "${deleteTarget?.name}"?`}
        confirmLabel="Revoke Access"
        variant="destructive"
        onConfirm={handleDeleteUser}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      />
    </div>
  )
}
