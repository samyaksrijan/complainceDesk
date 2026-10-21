import { prisma } from "@/lib/prisma"
import { withAnyRole } from "@/lib/rbac"
import { readFile } from "@/services/storage"
import { NextResponse } from "next/server"
export const GET = withAnyRole<{ id: string }>(async (_req, { user, params }) => {
  const { id } = await params
  const document = await prisma.document.findFirst({ where: { id, orgId: user.orgId } })
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  const bytes = await readFile(document.fileUrl)
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.name + (document.name.endsWith('.' + document.fileType) ? '' : '.' + document.fileType))}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
})
