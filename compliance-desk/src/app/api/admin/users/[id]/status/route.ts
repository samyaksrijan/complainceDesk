import { withAdmin } from "@/lib/rbac"
import { updateMember } from "@/services/members"
import { NextResponse } from "next/server"
import { z } from "zod"
const schema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) })
export const PUT = withAdmin<{ id: string }>(async (req, { user, params }) => {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid account status" }, { status: 400 })
  const result = await updateMember(user, (await params).id, parsed.data)
  return NextResponse.json("error" in result ? { error: result.error } : { user: result.user, message: "Account status updated" }, { status: result.status })
})
