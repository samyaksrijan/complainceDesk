import { authOptions } from "@/lib/auth"
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit"
import NextAuth from "next-auth"
import { NextResponse } from "next/server"

const handler = NextAuth(authOptions)

// Fix 7: Rate-limited POST handler for login attempts
async function rateLimitedPost(req: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  // Only rate-limit credential submissions
  const url = new URL(req.url)
  const isSignIn = url.pathname.includes("callback/credentials") || url.pathname.includes("signin")

  if (isSignIn) {
    const ip = getClientIp(req)
    const rateLimit = await checkRateLimit(`login:${ip}`, RATE_LIMITS.LOGIN)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later.", code: "RATE_LIMITED" },
        { status: 429 }
      )
    }
  }

  return handler(req, context)
}

export { handler as GET, rateLimitedPost as POST }
