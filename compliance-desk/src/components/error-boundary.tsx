"use client"

import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react"
import React from "react"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  showDetails: boolean
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, showDetails: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    const { error, showDetails } = this.state

    return (
      <div
        className="flex items-center justify-center min-h-[60vh] p-8"
        role="alert"
        aria-live="assertive"
      >
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center space-y-5"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid rgba(248,113,113,0.25)",
          }}
        >
          {/* Icon */}
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
            style={{
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
            }}
          >
            <AlertTriangle
              className="h-8 w-8"
              style={{ color: "var(--error)" }}
            />
          </div>

          {/* Message */}
          <div>
            <h2
              className="text-xl font-display font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Something went wrong
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              An unexpected error occurred. You can try reloading the page, or
              contact support if the problem persists.
            </p>
          </div>

          {/* Reload button */}
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: "var(--green-600)",
              color: "white",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--green-500)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--green-600)")
            }
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </button>

          {/* Expandable error details */}
          {error && (
            <div className="text-left">
              <button
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                className="flex items-center gap-1.5 text-xs font-medium transition-colors w-full"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-muted)")
                }
                aria-expanded={showDetails}
              >
                <ChevronDown
                  className="h-3.5 w-3.5 transition-transform"
                  style={{ transform: showDetails ? "rotate(180deg)" : "none" }}
                />
                {showDetails ? "Hide" : "Show"} error details
              </button>

              {showDetails && (
                <pre
                  className="mt-3 p-3 rounded-lg text-xs overflow-auto max-h-40 font-mono"
                  style={{
                    background: "var(--bg-deep)",
                    color: "var(--error)",
                    border: "1px solid var(--border)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {error.message}
                  {error.stack ? `\n\n${error.stack}` : ""}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}
