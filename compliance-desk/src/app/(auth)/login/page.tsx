"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fillDemoAccount = (role: "admin" | "auditor" | "viewer") => {
    setEmail(`${role}@demo.com`);
    setPassword("password123");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const health = await fetch("/api/health", { cache: "no-store" });
      if (!health.ok) {
        setError("The workspace is temporarily unavailable. Please try again shortly. If this continues, contact your administrator.");
        return;
      }
      const result = await signIn("credentials", { redirect: false, email: email.trim(), password });
      if (!result?.ok || result.error) {
        setError(result?.status === 429 ? "Too many sign-in attempts. Please wait a few minutes and try again." : "Invalid email or password");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("We couldn’t connect to your workspace. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Your workspace, in focus</p>
      <h2 className="font-display text-4xl font-semibold tracking-[-0.045em] text-slate-950">Welcome back.</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">Sign in to pick up where your team left off.</p>
      <form onSubmit={handleSubmit} className="mt-9 space-y-6" aria-busy={loading}>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-slate-800">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} aria-describedby={error ? "login-error" : undefined} className="h-12 rounded-xl border-slate-300 bg-white/80 px-4 text-base text-slate-950 caret-brand-700 shadow-none placeholder:text-slate-500 md:text-sm" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3"><Label htmlFor="password" className="text-sm font-medium text-slate-800">Password</Label><Link href="/reset-password" className="text-xs font-medium text-brand-700 underline-offset-4 hover:underline">Forgot password?</Link></div>
          <div className="relative">
            <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} aria-describedby={error ? "login-error" : undefined} className="h-12 rounded-xl border-slate-300 bg-white/80 pl-4 pr-12 text-base text-slate-950 caret-brand-700 shadow-none placeholder:text-slate-500 md:text-sm" />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </div>
        </div>
        {error && <p id="login-error" role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800">{error}</p>}
        <Button type="submit" disabled={loading} className="h-12 w-full justify-between rounded-xl bg-[#193d34] px-5 text-sm font-medium text-white shadow-none hover:bg-brand-800">{loading ? "Signing in…" : "Sign in to workspace"}{loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}</Button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-600">New to Compliance Desk? <Link href="/register" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Create a workspace</Link></p>
      {process.env.NODE_ENV !== "production" && <div className="mt-10 border-t border-slate-200 pt-5"><p className="text-center text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Local development accounts</p><div className="mt-3 grid grid-cols-3 gap-2">{(["admin", "auditor", "viewer"] as const).map(role => <button key={role} type="button" disabled={loading} aria-pressed={email === `${role}@demo.com`} onClick={() => fillDemoAccount(role)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-800 transition-colors hover:border-brand-400 hover:bg-brand-50 aria-pressed:border-brand-600 aria-pressed:bg-brand-100 aria-pressed:text-brand-900 disabled:opacity-50">{role[0].toUpperCase() + role.slice(1)}</button>)}</div><p className="mt-3 text-center text-xs leading-5 text-slate-600">Choose a role to fill its credentials, then sign in.</p></div>}
    </div>
  );
}
