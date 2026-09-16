"use client"

export function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-5 space-y-3"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="h-5 w-3/4 rounded animate-shimmer-green"
      />
      <div
        className="h-4 w-full rounded animate-shimmer-green"
        style={{ animationDelay: "0.1s" }}
      />
      <div
        className="h-4 w-2/3 rounded animate-shimmer-green"
        style={{ animationDelay: "0.2s" }}
      />
      <div className="flex gap-2 pt-2">
        <div
          className="h-5 w-16 rounded-full animate-shimmer-green"
          style={{ animationDelay: "0.3s" }}
        />
        <div
          className="h-5 w-20 rounded-full animate-shimmer-green"
          style={{ animationDelay: "0.4s" }}
        />
      </div>
    </div>
  )
}
