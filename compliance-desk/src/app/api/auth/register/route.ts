import { prisma } from "@/lib/prisma"
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit"
import { registerSchema, sanitizeText } from "@/lib/validation"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    // Fix 7: Rate limit registration
    const ip = getClientIp(req)
    const rateLimit = await checkRateLimit(`register:${ip}`, RATE_LIMITS.REGISTER)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
        { status: 429 }
      )
    }

    const body = await req.json()

    // Validate input
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: "Validation failed", 
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors 
        },
        { status: 400 }
      )
    }

    const { email, password, name, orgName } = parsed.data

    // Fix 8: Sanitize user-supplied text
    const sanitizedName = sanitizeText(name)
    const sanitizedOrgName = sanitizeText(orgName)

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (existingUser) {
      return NextResponse.json(
        { 
          error: "A user with this email already exists",
          code: "CONFLICT" 
        },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create org and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: sanitizedOrgName },
      })

      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          name: sanitizedName,
          role: "ADMIN",
          orgId: org.id,
        },
      })

      return { org, user }
    })

    return NextResponse.json(
      {
        message: "Registration successful",
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          orgId: result.org.id,
          orgName: result.org.name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    console.error("Registration error:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        code: "INTERNAL_ERROR" 
      },
      { status: 500 }
    )
  }
}
