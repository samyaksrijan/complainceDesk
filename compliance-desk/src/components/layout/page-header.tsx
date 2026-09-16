"use client"

import { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    icon?: LucideIcon
    onClick: () => void
  }
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1
          className="text-2xl font-display tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
          style={{ background: "var(--green-600)", color: "white" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--green-500)"
            e.currentTarget.style.transform = "translateY(-1px)"
            e.currentTarget.style.boxShadow = "0 4px 12px var(--glow-green)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--green-600)"
            e.currentTarget.style.transform = "translateY(0)"
            e.currentTarget.style.boxShadow = "none"
          }}
        >
          {action.icon && <action.icon className="h-4 w-4" />}
          {action.label}
        </button>
      )}
    </div>
  )
}
