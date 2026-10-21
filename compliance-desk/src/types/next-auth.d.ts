import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      orgId: string
      orgName: string
    } & DefaultSession["user"]
  }

  interface User {
    authenticatedAt?: number
    id: string
    email: string
    name: string
    role: string
    orgId: string
    orgName: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string
    role: string
    orgId: string
    orgName: string
    authenticatedAt?: number
    invalid?: boolean
  }
}
