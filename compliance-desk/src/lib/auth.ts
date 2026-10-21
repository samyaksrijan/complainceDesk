import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  providers: [CredentialsProvider({
    name: "credentials",
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) return null
      const authenticatedAt = Date.now()
      const user = await prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase().trim() }, include: { org: true },
      })
      if (!user || user.status !== "ACTIVE" || !await bcrypt.compare(credentials.password, user.passwordHash)) return null
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
        prisma.activityLog.create({ data: { orgId: user.orgId, userId: user.id, action: "user.login", resourceType: "user", resourceId: user.id } }),
      ])
      return { authenticatedAt, id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId, orgName: user.org.name }
    },
  })],
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.authenticatedAt = user.authenticatedAt ?? Date.now()
      }
      // Check every request: role changes, deactivation and password resets take effect immediately.
      try {
        const fresh = token.userId ? await prisma.user.findUnique({ where: { id: token.userId }, include: { org: true } }) : null
        token.invalid = !fresh || fresh.status !== "ACTIVE" || !!(fresh.passwordChangedAt && fresh.passwordChangedAt.getTime() > (token.authenticatedAt || 0))
        if (fresh && !token.invalid) {
          token.role = fresh.role
          token.orgId = fresh.orgId
          token.orgName = fresh.org.name
          token.name = fresh.name
          token.email = fresh.email
        }
      } catch {
        token.invalid = true // Fail closed when account status cannot be verified.
      }
      return token
    },
    async session({ session, token }) {
      if (token.invalid) return Object.assign(session, { user: undefined })
      session.user = { ...session.user, id: token.userId, role: token.role, orgId: token.orgId, orgName: token.orgName, name: token.name, email: token.email }
      return session
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
}
