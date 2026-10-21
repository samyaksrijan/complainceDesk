"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { StatusBadge } from "@/components/ui/status-badge"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { usePageTitle } from "@/lib/use-page-title"
import {
    Cpu,
    Lock,
    Save,
    User
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function SettingsPage() {
  usePageTitle("System Preferences")
  const { user } = useAuth()

  const [name, setName] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const { update } = useSession()
  const [engine, setEngine] = useState<Record<string, string>>({})
  useEffect(() => {
    api.get<{ name: string; email: string }>("/api/users/me").then(({ data, error }) => { if (data) { setName(data.name); setEmail(data.email) } else if (error) toast.error(error) })
    api.get<{ checks: Record<string, string> }>("/api/health").then(({ data }) => { if (data) setEngine(data.checks) })
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const { error } = await api.put("/api/users/me", { name, email })
    setIsSaving(false)
    if (error) toast.error(error)
    else { await update(); toast.success("Profile preferences saved successfully") }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setIsSaving(true)
    const { error } = await api.post("/api/auth/change-password", { currentPassword, newPassword })
    setIsSaving(false)
    if (error) toast.error(error)
    else { toast.success("Password updated. Please sign in again."); await signOut({ callbackUrl: "/login" }) }
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
              User Profile & Configuration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">
            System & Account Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your personal profile, authentication credentials, and evaluation engine telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={user?.role || "ADMIN"} size="md" />
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1 rounded-2xl shadow-xs">
          <TabsTrigger
            value="profile"
            className="text-xs data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 text-slate-500 font-bold rounded-xl px-4 py-1.5 flex items-center gap-1.5"
          >
            <User className="h-3.5 w-3.5" />
            Profile Details
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="text-xs data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 text-slate-500 font-bold rounded-xl px-4 py-1.5 flex items-center gap-1.5"
          >
            <Lock className="h-3.5 w-3.5" />
            Security & Password
          </TabsTrigger>
          <TabsTrigger
            value="engine"
            className="text-xs data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 text-slate-500 font-bold rounded-xl px-4 py-1.5 flex items-center gap-1.5"
          >
            <Cpu className="h-3.5 w-3.5" />
            Engine Telemetry
          </TabsTrigger>
        </TabsList>

        {/* PROFILE TAB */}
        <TabsContent value="profile">
          <form onSubmit={handleSaveProfile} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-brand-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Corporate Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed font-medium"
                />
                <span className="text-[10px] text-slate-400">Contact admin to modify corporate email.</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5 text-brand-400" />
                {isSaving ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </form>
        </TabsContent>

        {/* SECURITY TAB */}
        <TabsContent value="security">
          <form onSubmit={handleUpdatePassword} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-brand-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-brand-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-brand-500 font-medium"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSaving || !newPassword}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Lock className="h-3.5 w-3.5 text-brand-400" />
                Update Password
              </button>
            </div>
          </form>
        </TabsContent>

        {/* ENGINE TELEMETRY TAB */}
        <TabsContent value="engine">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight font-display">
                Automated Verification Engine Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configured status of the regulatory extraction and rule matching pipelines.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 font-display">Primary Extraction LPU</span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {engine.groq || "Not configured"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">Model: <strong className="text-slate-900">{engine.groqModel || "—"}</strong></p>
                <p className="text-[11px] text-slate-400 mt-1">Connectivity is checked when a document is evaluated.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 font-display">Secondary Fallback Pipeline</span>
                  <span className="text-[10px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                    {engine.gemini || "Not configured"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">Model: <strong className="text-slate-900">{engine.geminiModel || "—"}</strong></p>
                <p className="text-[11px] text-slate-400 mt-1">Automatic failover enabled on error</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block font-display">Document Parsing & OCR Engine</span>
                <span className="text-[11px] text-slate-500 font-medium">Digital PDF (pdf-parse) + Scanned Optical OCR (Tesseract.js) + DOCX (mammoth)</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {engine.database === "ok" ? "Available" : "Unavailable"}
              </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
