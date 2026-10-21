import { withAdmin } from "@/lib/rbac"
import { updateMember } from "@/services/members"
import { NextResponse } from "next/server"
export const DELETE = withAdmin<{ id: string }>(async (_req, { user, params }) => {
  const result = await updateMember(user, (await params).id, { status: "DELETED" })
  return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : new Response(null, { status: 204 })
})
