"use client"

interface StatusBadgeProps {
  status: string
  size?: "sm" | "md"
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  // Document statuses
  UPLOADED:        { bg: "rgba(156, 163, 175, 0.15)", text: "#9ca3af", label: "Uploaded" },
  PROCESSING:      { bg: "rgba(96, 165, 250, 0.15)",  text: "#60a5fa", label: "Processing" },
  MATCHED:         { bg: "rgba(34, 211, 238, 0.15)",   text: "#22d3ee", label: "Matched" },
  UNMATCHED:       { bg: "rgba(251, 191, 36, 0.15)",   text: "#fbbf24", label: "Unmatched" },
  UNDER_REVIEW:    { bg: "rgba(168, 85, 247, 0.15)",   text: "#a855f7", label: "Under Review" },
  COMPLIANT:       { bg: "rgba(34, 197, 94, 0.15)",    text: "#22c55e", label: "Compliant" },
  NON_COMPLIANT:   { bg: "rgba(248, 113, 113, 0.15)",  text: "#f87171", label: "Non-Compliant" },

  // Result statuses
  PASS:            { bg: "rgba(34, 197, 94, 0.15)",    text: "#22c55e", label: "Pass" },
  FAIL:            { bg: "rgba(248, 113, 113, 0.15)",  text: "#f87171", label: "Fail" },
  NOT_FOUND:       { bg: "rgba(107, 114, 128, 0.15)",  text: "#6b7280", label: "Not Found" },
  NEEDS_REVIEW:    { bg: "rgba(251, 191, 36, 0.15)",   text: "#fbbf24", label: "Needs Review" },

  // Roles
  ADMIN:           { bg: "rgba(34, 197, 94, 0.15)",    text: "#4ade80", label: "Admin" },
  AUDITOR:         { bg: "rgba(96, 165, 250, 0.15)",   text: "#60a5fa", label: "Auditor" },
  VIEWER:          { bg: "rgba(90, 125, 106, 0.2)",    text: "#5a7d6a", label: "Viewer" },

  // Source types
  TEMPLATE:        { bg: "rgba(168, 85, 247, 0.15)",   text: "#a855f7", label: "Template" },
  SCANNED:         { bg: "rgba(34, 211, 238, 0.15)",   text: "#22d3ee", label: "Scanned" },
  MANUAL:          { bg: "rgba(96, 165, 250, 0.15)",   text: "#60a5fa", label: "Manual" },

  // Boolean
  true:            { bg: "rgba(34, 197, 94, 0.15)",    text: "#22c55e", label: "Yes" },
  false:           { bg: "rgba(107, 114, 128, 0.15)",  text: "#6b7280", label: "No" },
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const style = statusStyles[status] || {
    bg: "rgba(107, 114, 128, 0.15)",
    text: "#6b7280",
    label: status,
  }

  return (
    <span
      className={`inline-flex items-center font-semibold uppercase tracking-wider rounded-full ${
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}
