import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ArrowUpRight, Check, Layers2 } from "lucide-react";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");

  return (
    <div className="auth-shell min-h-svh bg-[#f7f6f0] font-sans lg:grid lg:grid-cols-[1fr_1fr]">
      <aside className="relative isolate flex flex-col overflow-hidden bg-[#193d34] px-6 py-7 text-[#edf2e9] sm:px-10 lg:min-h-svh lg:px-14 lg:py-10 xl:px-20">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-white/20 bg-white/5"><Layers2 className="size-5" aria-hidden="true" /></span>
          <span className="text-lg font-semibold tracking-tight">compliance<span className="font-normal text-[#b5ccbe]">desk</span><span className="ml-1 text-[#bdd394]">.</span></span>
        </div>
        <div className="relative my-auto hidden py-16 lg:block">
          <p className="mb-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-[#b5ccbe]"><span className="h-px w-7 bg-[#a7bd92]" /> A clearer way to comply</p>
          <h1 className="max-w-lg font-display text-5xl leading-[1.12] tracking-[-0.045em] xl:text-6xl">Less complexity.<br /><span className="text-[#c7d9ad]">More clarity.</span></h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-[#b5ccbe]">Bring documents, requirements, and decisions together. Give every review a clear path forward.</p>
          <div aria-hidden="true" className="relative mt-14 max-w-sm rounded-2xl border border-white/15 bg-white/[0.04] p-6 shadow-xl shadow-black/5">
            <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4"><span className="text-xs font-medium text-[#d9e5d9]">From evidence to insight</span><ArrowUpRight className="size-4 text-[#a7bd92]" /></div>
            {["Organize your documents", "Review against requirements", "Keep a traceable record"].map((text, i) => <div key={text} className="flex items-center gap-4 py-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#b5ccbe]/25 text-[10px] text-[#c7d9ad]">0{i + 1}</span><span className="text-sm text-[#d9e5d9]">{text}</span>{i === 0 && <Check className="ml-auto size-4 text-[#c7d9ad]" />}</div>)}
          </div>
        </div>
        <div className="hidden items-center justify-between gap-4 border-t border-white/10 pt-5 text-[11px] tracking-wide text-[#a3bbaf] lg:flex"><span>Built for considered decisions.</span><span>Compliance Desk</span></div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-48 top-1/3 -z-10 size-[36rem] rounded-full border border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-[38%] -z-10 size-[28rem] rounded-full border border-white/5" />
      </aside>
      <main className="flex min-w-0 flex-col items-center justify-center px-5 py-10 sm:px-10 lg:px-14 lg:py-14">
        <div className="w-full max-w-[410px]">{children}</div>
        <p className="mt-10 text-center text-[11px] text-slate-500">Documents. Decisions. A clearer record.</p>
      </main>
    </div>
  );
}
