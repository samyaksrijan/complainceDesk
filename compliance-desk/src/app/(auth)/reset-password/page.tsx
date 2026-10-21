"use client"
import { api } from "@/lib/api"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
export default function ResetPasswordPage() {
  const [token, setToken] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  useEffect(() => { const timer = setTimeout(() => setToken(new URLSearchParams(window.location.search).get("token") || ""), 0); return () => clearTimeout(timer) }, [])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("")
    if (token && password !== confirm) { setError("Passwords do not match"); return }
    setBusy(true)
    const result = await api.post<{ message: string }>("/api/auth/reset-password", token ? { token, newPassword: password } : { email })
    setBusy(false)
    if (result.error) setError(result.error)
    else setMessage(result.data?.message || "Password updated")
  }
  return <div className="rounded-2xl bg-white border border-border p-8 shadow-sm">
    <ShieldCheck className="h-9 w-9 text-primary mb-5" />
    <h1 className="text-2xl font-semibold">{token ? "Set your password" : "Recover your account"}</h1>
    <p className="text-sm text-muted-foreground mt-2 mb-6">{token ? "Choose a password with at least 8 characters, a letter and a number." : "We’ll email you a secure, single-use recovery link."}</p>
    <form onSubmit={submit} className="space-y-4">
      {token ? <><label className="block text-sm">New password<input aria-label="New password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className="mt-2 w-full rounded-lg border p-3" value={password} onChange={e => setPassword(e.target.value)} /></label><label className="block text-sm">Confirm password<input aria-label="Confirm password" type="password" autoComplete="new-password" required className="mt-2 w-full rounded-lg border p-3" value={confirm} onChange={e => setConfirm(e.target.value)} /></label></> : <label className="block text-sm">Email address<input aria-label="Email address" type="email" autoComplete="email" required className="mt-2 w-full rounded-lg border p-3" value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      <button disabled={busy || !!message} className="w-full rounded-lg bg-primary py-3 text-white font-medium disabled:opacity-50">{busy ? "Processing…" : token ? "Update password" : "Send recovery link"}</button>
    </form>
    <Link href="/login" className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={14} />Back to sign in</Link>
  </div>
}
