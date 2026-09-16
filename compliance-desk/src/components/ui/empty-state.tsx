"use client"

import { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div
        className="h-16 w-16 rounded-2xl flex items-center justify-center mb-6"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
        }}
      >
        <Icon className="h-8 w-8" style={{ color: "var(--text-muted)" }} />
      </div>
      <h3 className="text-lg font-display mb-2" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      <p className="text-sm text-center max-w-md mb-6" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
          style={{ background: "var(--green-600)", color: "white" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--green-500)"
            e.currentTarget.style.transform = "translateY(-1px)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--green-600)"
            e.currentTarget.style.transform = "translateY(0)"
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
