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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { org: true },
        })

        // Fix 3: Generic error message — don't reveal whether email or password was wrong
        if (!user) {
          throw new Error("Invalid email or password")
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isValid) {
          throw new Error("Invalid email or password")
        }

        // TD-3: Log successful login
        try {
          await prisma.activityLog.create({
            data: {
              action: "user.login",
              resourceType: "user",
              resourceId: user.id,
              userId: user.id,
              orgId: user.orgId,
              metadata: { email: user.email },
            },
          })
        } catch {
          // Don't let logging failure break login
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgId: user.orgId,
          orgName: user.org.name,
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

      // On subsequent requests, refresh role every 5 minutes
      const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
      const now = Date.now()

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
          } else {
            // User was deleted — invalidate token
            return {} as any
          }
        } catch (error) {
          // On DB error, keep existing token data
          console.error("Failed to refresh user role:", error)
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
