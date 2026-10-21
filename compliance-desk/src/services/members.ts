import { Role, UserStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { SessionUser } from "@/lib/rbac"

/** Serializes membership changes per organization so concurrent requests cannot remove every administrator. */
export async function updateMember(actor: SessionUser, id: string, change: { role?: Role; status?: UserStatus }) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${actor.orgId} FOR UPDATE`
    const freshActor = await tx.user.findFirst({ where: { id: actor.id, orgId: actor.orgId, status: "ACTIVE", role: "ADMIN" } })
    if (!freshActor) return { error: "Administrator access is no longer active", status: 403 } as const
    if (id === actor.id) return { error: "You cannot change your own access or account status", status: 400 } as const
    const target = await tx.user.findFirst({ where: { id, orgId: actor.orgId, status: { not: "DELETED" } } })
    if (!target) return { error: "Member not found", status: 404 } as const
    const removesAdmin = target.role === "ADMIN" && target.status === "ACTIVE" && ((change.role && change.role !== "ADMIN") || (change.status && change.status !== "ACTIVE"))
    if (removesAdmin && await tx.user.count({ where: { orgId: actor.orgId, role: "ADMIN", status: "ACTIVE" } }) <= 1) return { error: "Cannot remove the last active administrator", status: 409 } as const
    const updated = await tx.user.update({ where: { id }, data: change, select: { id: true, name: true, email: true, role: true, status: true } })
    await tx.activityLog.create({ data: { orgId: actor.orgId, userId: actor.id, action: change.role ? "user_role_changed" : change.status === "DELETED" ? "user.removed" : "user_status_changed", resourceType: "user", resourceId: id, metadata: { email: target.email, oldRole: target.role, newRole: updated.role, oldStatus: target.status, newStatus: updated.status } } })
    if (change.role) await tx.notification.create({ data: { userId: id, orgId: actor.orgId, type: "ROLE_CHANGED", title: "Your role was updated", message: `Your role is now ${updated.role}.`, actorId: actor.id, targetType: "USER", targetId: id } })
    return { user: updated, status: 200 } as const
  }, { timeout: 10000 })
}
