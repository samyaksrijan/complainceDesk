import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

// Fix 17: Validate NEXTAUTH_SECRET at startup
if (!process.env.NEXTAUTH_SECRET) {
  console.warn(
    "WARNING: NEXTAUTH_SECRET is not set. " +
    "Sessions will not be secure. Set this in .env"
  )
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required")
        }

        const email = credentials.email.toLowerCase().trim()
        const password = credentials.password

        // 1. First check if this is a built-in sandbox demo account
        const DEMO_ACCOUNTS: Record<string, { id: string; name: string; role: "ADMIN" | "AUDITOR" | "VIEWER"; orgId: string; orgName: string }> = {
          "admin@demo.com": {
            id: "demo-admin-id",
            name: "System Administrator",
            role: "ADMIN",
            orgId: "demo-org-1",
            orgName: "Apex Compliance Corp",
          },
          "auditor@demo.com": {
            id: "demo-auditor-id",
            name: "Dr. Eleanor Vance",
            role: "AUDITOR",
            orgId: "demo-org-1",
            orgName: "Apex Compliance Corp",
          },
          "viewer@demo.com": {
            id: "demo-viewer-id",
            name: "Observer Officer",
            role: "VIEWER",
            orgId: "demo-org-1",
            orgName: "Apex Compliance Corp",
          },
        }

        if (DEMO_ACCOUNTS[email] && password === "password123") {
          const demoUser = DEMO_ACCOUNTS[email]
          return {
            id: demoUser.id,
            email,
            name: demoUser.name,
            role: demoUser.role,
            orgId: demoUser.orgId,
            orgName: demoUser.orgName,
          }
        }

        // 2. Otherwise query database
        try {
          const user = await prisma.user.findUnique({
            where: { email },
            include: { org: true },
          })

          if (!user) {
            throw new Error("Invalid email or password")
          }

          const isValid = await bcrypt.compare(password, user.passwordHash)
          if (!isValid) {
            throw new Error("Invalid email or password")
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            orgId: user.orgId,
            orgName: user.org.name,
          }
        } catch (dbError: any) {
          console.error("[Auth] Database lookup error:", dbError?.message)
          throw new Error("Invalid email or password")
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // Fix 18: 24 hours (was 30 days)
  },
  callbacks: {
    // Fix 4: JWT role refresh every 5 minutes
    async jwt({ token, user }) {
      // On initial login, set all fields from user object
      if (user) {
        token.userId = user.id
        token.role = user.role
        token.orgId = user.orgId
        token.orgName = user.orgName
        token.lastRoleCheck = Date.now()
        return token
      }

      // On subsequent requests, refresh role every 5 minutes (for real DB users)
      const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
      const now = Date.now()

      if (token.userId && String(token.userId).startsWith("demo-")) {
        return token
      }

      if (
        !token.lastRoleCheck ||
        now - (token.lastRoleCheck as number) > REFRESH_INTERVAL
      ) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { role: true, orgId: true },
          })

          if (freshUser) {
            token.role = freshUser.role
            token.orgId = freshUser.orgId
            token.lastRoleCheck = now
          }
        } catch (error) {
          // On DB error, keep existing token data
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
        session.user.orgId = token.orgId as string
        session.user.orgName = token.orgName as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
