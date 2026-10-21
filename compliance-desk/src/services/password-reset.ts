import { prisma } from "@/lib/prisma"
import { sendAccountLink } from "@/services/email"
import bcrypt from "bcryptjs"
import { createHash, randomBytes } from "node:crypto"

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

export async function issuePasswordLink(user: { id: string; email: string; name: string }, invitation = false) {
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  const token = randomBytes(32).toString("hex")
  const tokenHash = hashToken(token)
  await prisma.passwordResetToken.create({ data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } })
  try { await sendAccountLink(user.email, user.name, token, invitation) }
  catch (error) {
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash } })
    throw error
  }
}

export async function consumePasswordLink(token: string, password: string) {
  const tokenHash = hashToken(token)
  const passwordHash = await bcrypt.hash(password, 12)
  return prisma.$transaction(async tx => {
    const record = await tx.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } })
    if (!record || record.expiresAt <= new Date() || record.user.status !== "ACTIVE") return false
    const claimed = await tx.passwordResetToken.deleteMany({ where: { tokenHash, expiresAt: { gt: new Date() } } })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash, passwordChangedAt: new Date() } })
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } })
    return true
  })
}
