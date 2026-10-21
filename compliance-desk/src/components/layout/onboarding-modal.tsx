"use client"

import { ArrowRight, BarChart2, CheckSquare, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const ONBOARDING_KEY = "compliance_desk_onboarded"

const STEPS = [
  {
    icon: Upload,
    iconColor: "var(--green-400)",
    title: "Upload your first document",
    description:
      'Navigate to Documents and click "Upload Document". We accept PDFs and Word documents. Our AI will extract and analyze the contents automatically.',
    action: "Go to Documents",
    href: "/documents",
  },
  {
    icon: CheckSquare,
    iconColor: "var(--info)",
    title: "Create a compliance checklist",
    description:
      "Checklists define the requirements your documents must meet. Create one from scratch, or scan an existing policy document to generate one automatically.",
    action: "Go to Checklists",
    href: "/checklists",
  },
  {
    icon: BarChart2,
    iconColor: "var(--success)",
    title: "View your compliance dashboard",
    description:
      "Once documents are analyzed, the Dashboard gives you an instant overview of your organization's compliance health, score distribution, and recent activity.",
    action: "Go to Dashboard",
    href: "/dashboard",
  },
]

export function OnboardingModal({ open, onClose }: { open?: boolean; onClose?: () => void } = {}) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY)
      if (!done) { const timer = setTimeout(() => setVisible(true), 0); return () => clearTimeout(timer) }
    } catch {}
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1")
    } catch {}
    setVisible(false)
    onClose?.()
  }

  const handleAction = () => {
    router.push(STEPS[step].href)
    dismiss()
  }

  if (!(open ?? visible)) return null

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 relative"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-focus)",
        }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-surface)"
            e.currentTarget.style.color = "var(--text-primary)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.color = "var(--text-muted)"
          }}
          aria-label="Dismiss onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 id="onboarding-title" className="text-xl font-display font-bold" style={{ color: "var(--text-primary)" }}>
            Welcome to Compliance Desk!
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Here&apos;s how to get started in 3 steps.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all"
              style={{
                width: i === step ? "24px" : "8px",
                height: "8px",
                background: i === step ? "var(--green-500)" : "var(--border)",
              }}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <Icon className="h-8 w-8" style={{ color: current.iconColor }} />
          </div>

          <div>
            <h3 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              {current.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {current.description}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          {step < STEPS.length - 1 ? (
            <>
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-colors"
                style={{ background: "var(--green-600)", color: "white" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--green-500)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--green-600)")}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-2.5 rounded-lg text-sm transition-colors border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                Skip
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleAction}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-colors"
                style={{ background: "var(--green-600)", color: "white" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--green-500)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--green-600)")}
              >
                {current.action}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-2.5 rounded-lg text-sm transition-colors border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
