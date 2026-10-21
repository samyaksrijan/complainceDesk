import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { isIP } from "node:net";

interface RateLimitConfig { windowMs: number; maxRequests: number }

/** Shared fixed-window counters: atomic upsert works across all application instances. */
export async function checkRateLimit(identifier: string, config: RateLimitConfig): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now()
  const window = Math.floor(now / config.windowMs)
  const expiresAt = new Date((window + 1) * config.windowMs)
  const key = createHash("sha256").update(`${identifier}:${window}`).digest("hex")
  const entry = await prisma.rateLimit.upsert({ where: { key }, create: { key, count: 1, expiresAt }, update: { count: { increment: 1 } } })
  // Bounded housekeeping; expired windows are never reused.
  if (entry.count === 1) await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now - config.windowMs) } } })
  return { allowed: entry.count <= config.maxRequests, retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)) }
}

/** Enable only behind an ingress that strips/overwrites client-supplied forwarding headers. */
export function getClientIp(request: Request): string {
  if (process.env.TRUST_PROXY !== "true") return "direct"
  // ALB appends the connecting client address as the rightmost entry.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
  return forwarded && isIP(forwarded) ? forwarded : "direct"
}
export const RATE_LIMITS = {
  LOGIN: { windowMs: 15 * 60 * 1000, maxRequests: 30 },
  REGISTER: { windowMs: 60 * 60 * 1000, maxRequests: 5 },
  LLM_SCAN: { windowMs: 60 * 1000, maxRequests: 10 },
  GENERAL: { windowMs: 60 * 1000, maxRequests: 100 },
}
