import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  orgId: string
  orgName: string
}

type Params = Record<string, string>
type RouteHandler<P extends Params> = (req: Request, context: { user: SessionUser; params: Promise<P> }) => Promise<Response>

export function withAuth<P extends Params = Params>(handler: RouteHandler<P>, allowedRoles?: Role[]) {
  return async (req: Request, context: { params: Promise<P> }) => {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated", code: "UNAUTHORIZED" }, { status: 401 })
      const user = session.user as SessionUser
      if (allowedRoles?.length && !allowedRoles.includes(user.role as Role)) {
        return NextResponse.json({ error: "You do not have permission to perform this action", code: "FORBIDDEN" }, { status: 403 })
      }
      return await handler(req, { user, params: context.params })
    } catch (error) {
      if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
      console.error("Auth middleware error:", error)
      return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 })
    }
  }
}
export function withAdmin<P extends Params = Params>(handler: RouteHandler<P>) { return withAuth(handler, [Role.ADMIN]) }
export function withAuditorOrAdmin<P extends Params = Params>(handler: RouteHandler<P>) { return withAuth(handler, [Role.ADMIN, Role.AUDITOR]) }
export function withAnyRole<P extends Params = Params>(handler: RouteHandler<P>) { return withAuth(handler) }
