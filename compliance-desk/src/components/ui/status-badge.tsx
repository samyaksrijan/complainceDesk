"use client"

interface StatusBadgeProps {
  status: string
  size?: "sm" | "md"
}

const statusStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
  // Document statuses
  UPLOADED:        { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1", label: "Uploaded" },
  PROCESSING:      { bg: "#fffbeb", text: "#b45309", border: "#fde68a", label: "Evaluating" },
  MATCHED:         { bg: "#f0f9ff", text: "#0284c7", border: "#bae6fd", label: "Mapped" },
  UNMATCHED:       { bg: "#fffbeb", text: "#d97706", border: "#fde68a", label: "Unmapped" },
  UNDER_REVIEW:    { bg: "#faf5ff", text: "#9333ea", border: "#e9d5ff", label: "In Review" },
  COMPLIANT:       { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", label: "Compliant" },
  NON_COMPLIANT:   { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", label: "Non-Compliant" },

  // Result statuses
  PASS:            { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", label: "Conforming" },
  FAIL:            { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", label: "Non-Conforming" },
  NOT_FOUND:       { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", label: "No Record" },
  NEEDS_REVIEW:    { bg: "#fffbeb", text: "#b45309", border: "#fde68a", label: "Audit Required" },

  // Roles
  ADMIN:           { bg: "#fffbeb", text: "#b45309", border: "#fde68a", label: "Admin" },
  AUDITOR:         { bg: "#f0f9ff", text: "#0284c7", border: "#bae6fd", label: "Lead Auditor" },
  VIEWER:          { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1", label: "Observer" },

  // Source types
  TEMPLATE:        { bg: "#faf5ff", text: "#9333ea", border: "#e9d5ff", label: "Standard Preset" },
  SCANNED:         { bg: "#fffbeb", text: "#b45309", border: "#fde68a", label: "Policy Extracted" },
  MANUAL:          { bg: "#f0f9ff", text: "#0284c7", border: "#bae6fd", label: "Custom Rule" },

  // Boolean
  true:            { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", label: "Yes" },
  false:           { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", label: "No" },
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const style = statusStyles[status] || {
    bg: "#f8fafc",
    text: "#64748b",
    border: "#e2e8f0",
    label: status,
  }

  return (
    <span
      className={`inline-flex items-center font-medium tracking-wide border rounded-full font-sans ${
        size === "sm" ? "text-[11px] px-2.5 py-0.5" : "text-xs px-3 py-1"
      } ${status === "PROCESSING" ? "animate-pulse" : ""}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      {style.label}
    </span>
  )
}
