import { prisma } from "@/lib/prisma"
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit"
import { registerSchema } from "@/lib/validation"
import { emailConfigured } from "@/services/email"
import { consumePasswordLink, issuePasswordLink } from "@/services/password-reset"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.union([
  z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), newPassword: registerSchema.shape.password }),
  z.object({ email: z.string().email().transform(value => value.toLowerCase().trim()) }),
])
export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit(`reset:${getClientIp(request)}`, RATE_LIMITS.REGISTER)
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Provide a valid email or reset token and a password with at least 8 characters, a letter and a number." }, { status: 400 })
    if ("token" in parsed.data) {
      const valid = await consumePasswordLink(parsed.data.token, parsed.data.newPassword)
      return NextResponse.json(valid ? { message: "Password updated. Please sign in again." } : { error: "This link has expired or has already been used." }, { status: valid ? 200 : 400 })
    }
    if (!emailConfigured()) return NextResponse.json({ error: "Password recovery is temporarily unavailable. Contact your administrator." }, { status: 503 })
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (user?.status === "ACTIVE") await issuePasswordLink(user)
    return NextResponse.json({ message: "If an account with that email exists, you will receive a password reset link." })
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Password recovery failed:", error)
    return NextResponse.json({ error: "Unable to process password recovery. Please try again later." }, { status: 503 })
  }
}
