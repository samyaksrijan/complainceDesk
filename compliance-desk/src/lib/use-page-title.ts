"use client"

import { useEffect } from "react"

/**
 * Sets document.title on the client side.
 * Used in "use client" pages where Next.js `metadata` export can't be used.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} — Compliance Desk` : "Compliance Desk"
    return () => {
      document.title = prev
    }
  }, [title])
}
