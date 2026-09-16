import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { Role } from "@prisma/client"

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  orgId: string
  orgName: string
}

type RouteHandler = (
  req: Request,
  context: { user: SessionUser; params?: Record<string, string> }
) => Promise<NextResponse>

export function withAuth(handler: RouteHandler, allowedRoles?: Role[]) {
  return async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const session = await getServerSession(authOptions)

      if (!session?.user) {
        return NextResponse.json(
          { error: "Not authenticated", code: "UNAUTHORIZED" },
          { status: 401 }
        )
      }

      const user = session.user as SessionUser

      if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(user.role as Role)) {
          return NextResponse.json(
            { 
              error: "You do not have permission to perform this action",
              code: "FORBIDDEN" 
            },
            { status: 403 }
          )
        }
      }

      return handler(req, { user, params: context?.params })
    } catch (error) {
      console.error("Auth middleware error:", error)
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      )
    }
  }
}

// Convenience wrappers
export function withAdmin(handler: RouteHandler) {
  return withAuth(handler, [Role.ADMIN])
}

export function withAuditorOrAdmin(handler: RouteHandler) {
  return withAuth(handler, [Role.ADMIN, Role.AUDITOR])
}

export function withAnyRole(handler: RouteHandler) {
  return withAuth(handler) // no role restriction, just auth
}
