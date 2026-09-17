"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ArrowRight, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const fillDemoAccount = (role: "admin" | "auditor" | "viewer") => {
    if (role === "admin") {
      setEmail("admin@demo.com");
      setPassword("password123");
    } else if (role === "auditor") {
      setEmail("auditor@demo.com");
      setPassword("password123");
    } else {
      setEmail("viewer@demo.com");
      setPassword("password123");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        toast.error("Invalid email or password");
      } else {
        toast.success("Authentication successful");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      toast.error("An error occurred during authentication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] overflow-hidden font-sans">
      {/* Top Banner Header */}
      <div className="p-8 pb-6 text-center border-b border-slate-100 bg-slate-50/60">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 items-center justify-center shadow-md mb-3">
          <ShieldCheck className="h-6 w-6 text-slate-950 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
          Compliance Desk
        </h1>
        <p className="text-xs uppercase tracking-wider text-amber-700 font-bold mt-1">
          Enterprise Governance & Regulatory Audit
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
              Corporate Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="officer@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 focus-visible:border-amber-500 h-10 text-xs font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Security Password
              </Label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 focus-visible:border-amber-500 h-10 text-xs font-medium"
              />
            </div>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold h-11 shadow-sm transition-all cursor-pointer font-sans text-xs tracking-wide" 
          disabled={loading}
        >
          {loading ? "Verifying Credentials..." : "Authenticate & Access Workspace"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        {/* Quick Demo Switcher */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500 text-center mb-2.5">
            Quick Sandbox Demo Accounts:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount("admin")}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-all text-center shadow-xs"
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount("auditor")}
              className="px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] font-bold text-sky-800 hover:bg-sky-100 transition-all text-center shadow-xs"
            >
              🔍 Auditor
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount("viewer")}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition-all text-center shadow-xs"
            >
              👁️ Viewer
            </button>
          </div>
        </div>

        <div className="text-xs text-center text-slate-500 pt-1">
          Need to onboard a new organization?{" "}
          <Link href="/register" className="text-amber-700 hover:text-amber-800 font-bold underline underline-offset-4">
            Register Organization
          </Link>
        </div>
      </form>
    </div>
  );
}
