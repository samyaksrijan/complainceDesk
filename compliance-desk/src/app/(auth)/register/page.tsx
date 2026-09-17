"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ArrowRight, Building, User, Mail, Lock } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const calculateStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length > 7) strength += 25;
    if (pwd.match(/[a-z]/)) strength += 25;
    if (pwd.match(/[A-Z]/)) strength += 25;
    if (pwd.match(/[0-9]/)) strength += 25;
    return strength;
  };

  const strength = calculateStrength(password);
  
  const getStrengthColor = () => {
    if (strength <= 25) return "bg-rose-500";
    if (strength <= 50) return "bg-amber-500";
    if (strength <= 75) return "bg-amber-400";
    return "bg-emerald-500";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (strength < 50) {
      toast.error("Password must contain at least 8 characters with letters and numbers.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          organizationName: orgName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register organization");
      }

      // Auto login after registration
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        toast.error("Account created. Please log in.");
        router.push("/login");
      } else {
        toast.success("Organization onboarded successfully");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] overflow-hidden font-sans my-4">
      {/* Top Banner Header */}
      <div className="p-6 text-center border-b border-slate-100 bg-slate-50/60">
        <div className="inline-flex h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 items-center justify-center shadow-md mb-2">
          <ShieldCheck className="h-6 w-6 text-slate-950 stroke-[2.5]" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 font-display">
          Onboard New Organization
        </h1>
        <p className="text-[11px] uppercase tracking-wider text-amber-700 font-bold mt-0.5">
          Deploy Your Dedicated Compliance Workspace
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="orgName" className="text-xs font-semibold text-slate-700">
              Organization Name
            </Label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="orgName"
                placeholder="Apex Global Technologies"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className="pl-9 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 focus-visible:border-amber-500 h-9.5 text-xs font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
              Lead Officer Full Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="name"
                placeholder="Dr. Eleanor Vance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="pl-9 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 focus-visible:border-amber-500 h-9.5 text-xs font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
              Corporate Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="e.vance@apexglobal.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 focus-visible:border-amber-500 h-9.5 text-xs font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
              Master Security Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                placeholder="Min 8 characters with letters & numbers"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-9 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 focus-visible:border-amber-500 h-9.5 text-xs font-medium"
              />
            </div>
            {password.length > 0 && (
              <div className="space-y-1 pt-1.5">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                    style={{ width: `${strength}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Complexity</span>
                  <span className={strength >= 75 ? "text-emerald-600" : strength >= 50 ? "text-amber-600" : "text-rose-600"}>
                    {strength <= 25 ? "Weak" : strength <= 50 ? "Fair" : strength <= 75 ? "Strong" : "Very Strong"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold h-10.5 shadow-sm transition-all cursor-pointer font-sans text-xs tracking-wide mt-2" 
          disabled={loading}
        >
          {loading ? "Initializing Workspace..." : "Create Organization Workspace"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <div className="text-xs text-center text-slate-500 pt-1">
          Already registered?{" "}
          <Link href="/login" className="text-amber-700 hover:text-amber-800 font-bold underline underline-offset-4">
            Sign In to Existing Workspace
          </Link>
        </div>
      </form>
    </div>
  );
}
