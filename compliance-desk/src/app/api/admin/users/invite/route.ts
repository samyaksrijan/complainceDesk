import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/rbac"
import { logActivity } from "@/services/activity"
import { emailConfigured } from "@/services/email"
import { issuePasswordLink } from "@/services/password-reset"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { z } from "zod"
const schema = z.object({ email: z.string().email().transform(v => v.toLowerCase().trim()), name: z.string().trim().min(2).max(100), role: z.enum(["ADMIN", "AUDITOR", "VIEWER"]) })
export const POST = withAdmin(async (req, { user }) => {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid name, email and role." }, { status: 400 })
  if (!emailConfigured()) return NextResponse.json({ error: "Invitations require configured email delivery. Contact your administrator." }, { status: 503 })
  const { email, name, role } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && (existing.orgId !== user.orgId || existing.lastLoginAt || existing.status !== "ACTIVE")) return NextResponse.json({ error: "Email is already in use" }, { status: 409 })
  const invited = existing || await prisma.user.create({ data: { email, name, role, orgId: user.orgId, passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12) } })
  try { await issuePasswordLink(invited, true) }
  catch (error) {
    console.error("Invitation email failed:", error)
    return NextResponse.json({ error: "Email delivery failed. Retry the invitation to resend the link." }, { status: 503 })
  }
  await logActivity({ orgId: user.orgId, userId: user.id, action: "user.invited", resourceType: "user", resourceId: invited.id, metadata: { email, role } })
  return NextResponse.json({ user: { id: invited.id, email, name: invited.name, role: invited.role }, message: "Invitation email sent." }, { status: 201 })
})
