import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import crypto from "crypto"
import { checkRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit"

const resetRequestSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: Request) {
  try {
    // Rate limit password resets
    const ip = getClientIp(request)
    const rateLimit = checkRateLimit(`reset:${ip}`, RATE_LIMITS.REGISTER)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = resetRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valid email is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    // Always return the same message (don't reveal if email exists)
    const GENERIC_MESSAGE = {
      message: "If an account with that email exists, you will receive a password reset link.",
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
    })

    if (!user) {
      return NextResponse.json(GENERIC_MESSAGE)
    }

    // Generate a temporary password (in production, use a token flow)
    const tempPassword = crypto.randomBytes(8).toString("hex")
    const hash = await bcrypt.hash(tempPassword, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    })

    // TODO: Send email with tempPassword or reset link
    // For now, log it (development only)
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Password reset for ${user.email}: ${tempPassword}`)
    }

    return NextResponse.json(GENERIC_MESSAGE)
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
