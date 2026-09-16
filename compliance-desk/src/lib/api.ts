"use client"

import { getSession } from "next-auth/react"

interface FetchOptions extends RequestInit {
  parseJson?: boolean
}

export async function apiFetch<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { parseJson = true, ...fetchOptions } = options

  try {
    const session = await getSession()

    const headers: Record<string, string> = {
      ...(fetchOptions.headers as Record<string, string>),
    }

    if (session?.user) {
      // NextAuth handles auth via cookies, but we can add
      // extra headers if needed
    }

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(fetchOptions.body instanceof FormData)) {
      headers["Content-Type"] = "application/json"
    }

    const res = await fetch(url, {
      ...fetchOptions,
      headers,
    })

    if (!res.ok) {
      let errorMessage = `Request failed with status ${res.status}`
      try {
        const errorBody = await res.json()
        errorMessage = errorBody.error || errorMessage
      } catch {}

      return { data: null, error: errorMessage, status: res.status }
    }

    if (!parseJson) {
      return { data: null, error: null, status: res.status }
    }

    const data = await res.json()
    return { data, error: null, status: res.status }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Network error",
      status: 0,
    }
  }
}

// Convenience methods
export const api = {
  get: <T = any>(url: string) => apiFetch<T>(url, { method: "GET" }),

  post: <T = any>(url: string, body?: any) =>
    apiFetch<T>(url, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T = any>(url: string, body?: any) =>
    apiFetch<T>(url, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  delete: <T = any>(url: string) =>
    apiFetch<T>(url, { method: "DELETE" }),
}
