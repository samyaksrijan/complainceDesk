import { NextResponse } from "next/server"

// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Clean up old entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

interface RateLimitConfig {
  windowMs: number   // Time window in milliseconds
  maxRequests: number // Max requests per window
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const key = identifier
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + config.windowMs })
    return { allowed: true }
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }

  entry.count++
  return { allowed: true }
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

// Predefined rate limit configs
export const RATE_LIMITS = {
  LOGIN: { windowMs: 15 * 60 * 1000, maxRequests: 30 },      // 30 per 15 min
  REGISTER: { windowMs: 60 * 60 * 1000, maxRequests: 5 },     // 5 per hour
  LLM_SCAN: { windowMs: 60 * 1000, maxRequests: 10 },         // 10 per minute
  GENERAL: { windowMs: 60 * 1000, maxRequests: 100 },          // 100 per minute
}
