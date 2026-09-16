"use client"

import { useState, useEffect, useCallback } from "react"
import { usePageTitle } from "@/lib/use-page-title"
import { useAuth } from "@/components/providers/auth-provider"
import { api } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  User,
  Lock,
  Bell,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  emailNotifications: boolean
  analysisCompleteNotifications: boolean
  weeklyDigest: boolean
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

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  if (!pw) return { level: 0, label: "", color: "" }
  const hasLower = /[a-z]/.test(pw)
  const hasUpper = /[A-Z]/.test(pw)
  const hasNum = /[0-9]/.test(pw)
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw)
  const score = [pw.length >= 8, pw.length >= 12, hasLower && hasUpper, hasNum, hasSpecial].filter(Boolean).length
  if (score <= 1) return { level: 1, label: "Weak", color: "var(--error)" }
  if (score <= 2) return { level: 2, label: "Fair", color: "var(--warning)" }
  if (score <= 3) return { level: 3, label: "Good", color: "#84cc16" }
  return { level: 4, label: "Strong", color: "var(--success)" }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const inputStyle = {
  background: "var(--bg-deep)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
}

function FormInput({
  label,
  id,
  type = "text",
  value,
  onChange,
  error,
  disabled = false,
  readOnly = false,
  suffix,
  placeholder,
}: {
  label: string
  id: string
  type?: string
  value: string
  onChange?: (v: string) => void
  error?: string
  disabled?: boolean
  readOnly?: boolean
  suffix?: React.ReactNode
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }} htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          disabled={disabled || readOnly}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
          style={{
            ...inputStyle,
            opacity: readOnly || disabled ? 0.6 : 1,
            cursor: readOnly ? "default" : "text",
            paddingRight: suffix ? "44px" : undefined,
          }}
          onFocus={(e) => {
            if (!readOnly) {
              e.currentTarget.style.borderColor = "var(--green-500)"
              e.currentTarget.style.boxShadow = "0 0 0 2px var(--glow-green)"
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "var(--error)" : "var(--border)"
            e.currentTarget.style.boxShadow = "none"
          }}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--error)" }}>{error}</p>
      )}
    </div>
  )
}

function PasswordInput({
  label,
  id,
  value,
  onChange,
  error,
  disabled,
  placeholder,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  error?: string
  disabled?: boolean
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <FormInput
      label={label}
      id={id}
      type={show ? "text" : "password"}
      value={value}
      onChange={onChange}
      error={error}
      disabled={disabled}
      placeholder={placeholder}
      suffix={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  )
}

function CardSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div className="mb-5">
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        {description && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{description}</p>}
      </div>
      {children}
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 flex-shrink-0 disabled:opacity-60"
      style={{
        background: checked ? "var(--green-600)" : "var(--bg-deep)",
        border: "1px solid " + (checked ? "var(--green-500)" : "var(--border)"),
      }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  )
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ profile, onSave }: { profile: UserProfile; onSave: (p: UserProfile) => void }) {
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [nameError, setNameError] = useState("")
  const [emailError, setEmailError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const isDirty = name !== profile.name || email !== profile.email

  const validate = () => {
    let valid = true
    if (!name.trim() || name.trim().length < 2) {
      setNameError("Name must be at least 2 characters")
      valid = false
    } else setNameError("")
    if (!email.trim() || !isValidEmail(email)) {
      setEmailError("Please enter a valid email address")
      valid = false
    } else setEmailError("")
    return valid
  }

  const handleSave = async () => {
    if (!validate()) return
    setIsSaving(true)
    const { data, error } = await api.put("/api/users/me", { name: name.trim(), email: email.trim() })
    if (error) {
      toast.error(error)
    } else {
      toast.success("Profile updated successfully")
      onSave({ ...profile, name: name.trim(), email: email.trim() })
    }
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      <CardSection title="Personal Information" description="Update your display name and email address.">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6 pb-6" style={{ borderBottom: "1px solid var(--border)" }}>
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: "var(--green-800)", color: "var(--green-300)", border: "2px solid var(--green-700)" }}
          >
            {getInitials(name || profile.name)}
          </div>
          <div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{name || profile.name}</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{email || profile.email}</p>
            <div className="mt-1">
              <StatusBadge status={profile.role} size="sm" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <FormInput
            label="Full Name"
            id="profile-name"
            value={name}
            onChange={setName}
            error={nameError}
            placeholder="Your full name"
          />
          <FormInput
            label="Email Address"
            id="profile-email"
            type="email"
            value={email}
            onChange={setEmail}
            error={emailError}
            placeholder="your@email.com"
          />
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Role"
              id="profile-role"
              value={profile.role}
              readOnly
            />
            <FormInput
              label="Member Since"
              id="profile-since"
              value={new Date(profile.createdAt).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
              readOnly
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--green-600)", color: "white" }}
            onMouseEnter={(e) => { if (isDirty && !isSaving) { e.currentTarget.style.background = "var(--green-500)"; e.currentTarget.style.boxShadow = "0 4px 12px var(--glow-green)" } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--green-600)"; e.currentTarget.style.boxShadow = "none" }}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </CardSection>
    </div>
  )
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const strength = getPasswordStrength(newPw)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!currentPw) e.currentPw = "Current password is required"
    if (!newPw || newPw.length < 8) e.newPw = "New password must be at least 8 characters"
    if (newPw && !/[0-9]/.test(newPw)) e.newPw = "Password must contain a number"
    if (newPw && !/[a-zA-Z]/.test(newPw)) e.newPw = "Password must contain a letter"
    if (newPw === currentPw && newPw) e.newPw = "New password must differ from current password"
    if (!confirmPw) e.confirmPw = "Please confirm your new password"
    else if (confirmPw !== newPw) e.confirmPw = "Passwords do not match"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setIsSaving(true)

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || "Password change failed")
      if (data.error?.includes("incorrect")) {
        setCurrentPw("")
        setErrors({ currentPw: "Current password is incorrect" })
      }
    } else {
      toast.success("Password updated successfully")
      setCurrentPw("")
      setNewPw("")
      setConfirmPw("")
      setErrors({})
    }
    setIsSaving(false)
  }

  const canSubmit = currentPw && newPw && confirmPw && !isSaving

  return (
    <div className="space-y-6">
      <CardSection title="Change Password" description="Use a strong password with a mix of letters, numbers, and symbols.">
        <div className="space-y-4">
          <PasswordInput
            label="Current Password"
            id="sec-current"
            value={currentPw}
            onChange={setCurrentPw}
            error={errors.currentPw}
            placeholder="Your current password"
          />

          <PasswordInput
            label="New Password"
            id="sec-new"
            value={newPw}
            onChange={setNewPw}
            error={errors.newPw}
            placeholder="Min. 8 characters"
          />

          {/* Strength indicator */}
          {newPw.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--text-muted)" }}>Password strength</span>
                <span style={{ color: strength.color }}>{strength.label}</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((lvl) => (
                  <div
                    key={lvl}
                    className="h-1.5 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background: lvl <= strength.level ? strength.color : "var(--bg-deep)",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <PasswordInput
            label="Confirm New Password"
            id="sec-confirm"
            value={confirmPw}
            onChange={setConfirmPw}
            error={errors.confirmPw}
            placeholder="Re-enter new password"
          />
        </div>

        <div className="flex justify-end mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--green-600)", color: "white" }}
            onMouseEnter={(e) => { if (canSubmit) { e.currentTarget.style.background = "var(--green-500)"; e.currentTarget.style.boxShadow = "0 4px 12px var(--glow-green)" } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--green-600)"; e.currentTarget.style.boxShadow = "none" }}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {isSaving ? "Updating…" : "Update Password"}
          </button>
        </div>
      </CardSection>
    </div>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

interface NotifPrefs {
  emailNotifications: boolean
  analysisCompleteNotifications: boolean
  weeklyDigest: boolean
}

function NotificationsTab({ profile }: { profile: UserProfile }) {
  const [prefs, setPrefs] = useState<NotifPrefs>({
    emailNotifications: profile.emailNotifications,
    analysisCompleteNotifications: profile.analysisCompleteNotifications,
    weeklyDigest: profile.weeklyDigest,
  })
  const [saving, setSaving] = useState<keyof NotifPrefs | null>(null)

  const toggle = async (key: keyof NotifPrefs) => {
    const oldVal = prefs[key]
    const newVal = !oldVal
    setPrefs((p) => ({ ...p, [key]: newVal }))
    setSaving(key)
    const { error } = await api.put("/api/users/me", { [key]: newVal })
    if (error) {
      setPrefs((p) => ({ ...p, [key]: oldVal })) // revert
      toast.error("Failed to save preference. Please try again.")
    }
    setSaving(null)
  }

  const notifItems: { key: keyof NotifPrefs; title: string; description: string }[] = [
    {
      key: "emailNotifications",
      title: "Email Notifications",
      description: "Master toggle for all email notifications from Compliance Desk. Disabling this overrides all other email preferences.",
    },
    {
      key: "analysisCompleteNotifications",
      title: "Analysis Complete",
      description: "Get notified via email when a document finishes its compliance analysis and results are ready to view.",
    },
    {
      key: "weeklyDigest",
      title: "Weekly Digest",
      description: "Receive a weekly summary email covering compliance activity, new documents, and outstanding issues.",
    },
  ]

  return (
    <div className="space-y-6">
      <CardSection title="Email Notifications" description="Control which emails Compliance Desk sends you.">
        <div className="space-y-5">
          {notifItems.map((item, idx) => (
            <div key={item.key}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{item.description}</p>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {saving === item.key && <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--text-muted)" }} />}
                  <ToggleSwitch
                    checked={prefs[item.key]}
                    onChange={() => toggle(item.key)}
                    disabled={!!saving || (item.key !== "emailNotifications" && !prefs.emailNotifications)}
                  />
                </div>
              </div>
              {idx < notifItems.length - 1 && (
                <div className="mt-5" style={{ borderBottom: "1px solid var(--border)" }} />
              )}
            </div>
          ))}
        </div>
      </CardSection>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  usePageTitle("Settings")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [showDangerDialog, setShowDangerDialog] = useState(false)

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    const { data, error } = await api.get("/api/users/me")
    if (error) setIsError(true)
    else if (data) setProfile(data)
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
        <div className="h-8 w-48 rounded animate-shimmer-green" />
        <div className="h-12 rounded-xl animate-shimmer-green" />
        <div className="h-64 rounded-xl animate-shimmer-green" />
        <div className="h-48 rounded-xl animate-shimmer-green" />
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 max-w-md mx-auto text-center">
        <AlertTriangle className="h-10 w-10 mb-4" style={{ color: "var(--error)" }} />
        <h2 className="text-lg font-display mb-2" style={{ color: "var(--text-primary)" }}>Failed to load profile</h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          There was an error loading your account information.
        </p>
        <button
          onClick={fetchProfile}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--green-600)", color: "white" }}
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-up max-w-3xl mx-auto pb-12">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Settings
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        {/* Tab list */}
        <TabsList
          className="inline-flex p-1 gap-1 rounded-xl"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          {[
            { value: "profile", icon: <User className="h-4 w-4" />, label: "Profile" },
            { value: "security", icon: <Lock className="h-4 w-4" />, label: "Security" },
            { value: "notifications", icon: <Bell className="h-4 w-4" />, label: "Notifications" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{ color: "var(--text-muted)" }}
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab
            profile={profile}
            onSave={(updated) => setProfile(updated)}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab profile={profile} />
        </TabsContent>
      </Tabs>

      {/* Danger zone — Admin only */}
      {isAdmin && (
        <div className="mt-10">
          <div
            className="rounded-xl p-6"
            style={{ border: "1px solid rgba(248, 113, 113, 0.3)", background: "rgba(248, 113, 113, 0.04)" }}
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "var(--error)" }} />
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--error)" }}>Danger Zone</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Irreversible and destructive actions. Proceed with caution.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between py-4 px-4 rounded-lg" style={{ background: "rgba(248, 113, 113, 0.06)", border: "1px solid rgba(248, 113, 113, 0.15)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Delete Account</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Permanently remove your account and all associated data.
                </p>
              </div>
              <button
                onClick={() => setShowDangerDialog(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors ml-4 flex-shrink-0"
                style={{ background: "transparent", border: "1px solid var(--error)", color: "var(--error)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.1)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger zone confirmation */}
      <ConfirmDialog
        open={showDangerDialog}
        onOpenChange={setShowDangerDialog}
        title="Account Deletion"
        description="Account deletion is managed by your system administrator for compliance and audit purposes. Please contact your administrator to initiate an account deletion request."
        confirmLabel="I Understand"
        onConfirm={() => {
          setShowDangerDialog(false)
          toast.info("Please contact your system administrator to delete your account.")
        }}
      />
    </div>
  )
}
