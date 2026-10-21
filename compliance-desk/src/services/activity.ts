import { prisma } from "@/lib/prisma"
import { NotificationType } from "@prisma/client"

interface LogActivityParams {
  orgId: string
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  metadata?: import("@prisma/client").Prisma.InputJsonObject
}

/**
 * Log a user activity. Silently fails if logging fails
 * (activity logging should never break the main flow).
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        orgId: params.orgId,
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        metadata: params.metadata || undefined,
      },
    })
    const events: Record<string, { type: NotificationType; title: string }> = {
      "document.uploaded": { type: "DOCUMENT_UPLOADED", title: "Document uploaded" },
      "document.checked": { type: "ANALYSIS_COMPLETE", title: "Compliance evaluation complete" },
      "document.deleted": { type: "DOCUMENT_DELETED", title: "Document deleted" },
      "checklist.created": { type: "CHECKLIST_CREATED", title: "Checklist created" },
      "checklist.updated": { type: "CHECKLIST_UPDATED", title: "Checklist updated" },
      "user.invited": { type: "USER_INVITED", title: "Member invited" },
      "user_role_changed": { type: "ROLE_CHANGED", title: "Member role updated" },
    }
    const event = events[params.action]
    if (event) {
      const recipients = await prisma.user.findMany({ where: { orgId: params.orgId, status: "ACTIVE", ...(event.type === "ANALYSIS_COMPLETE" ? { analysisCompleteNotifications: true } : {}) }, select: { id: true } })
      await prisma.notification.createMany({ data: recipients.map(recipient => ({ userId: recipient.id, orgId: params.orgId, type: event.type, title: event.title, message: `${event.title}${params.metadata?.name ? ': ' + String(params.metadata.name) : ''}`, actorId: params.userId, targetType: params.resourceType.toUpperCase(), targetId: params.resourceId })) })
    }
  } catch (error) {
    console.error("[ActivityLog] Failed to log activity:", error)
    // Do not throw — activity logging is non-critical
  }
}

/**
 * Get recent activity for an organization with pagination.
 * Uses batch queries instead of N+1 for resource name enrichment.
 */
export async function getRecentActivity(
  orgId: string,
  limit: number = 20,
  skip: number = 0
) {
  const logs = await prisma.activityLog.findMany({
    where: { orgId },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip,
  })

  // Collect resource IDs by type for batch fetching
  const documentIds = new Set<string>()
  const checklistIds = new Set<string>()
  const userIds = new Set<string>()

  for (const log of logs) {
    if (log.resourceId) {
      switch (log.resourceType) {
        case "document":
          documentIds.add(log.resourceId)
          break
        case "checklist":
          checklistIds.add(log.resourceId)
          break
        case "user":
          userIds.add(log.resourceId)
          break
      }
    }
  }

  // Batch fetch resource names (max 3 queries total instead of N)
  const [documents, checklists, users] = await Promise.all([
    documentIds.size > 0
      ? prisma.document.findMany({
          where: { id: { in: Array.from(documentIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    checklistIds.size > 0
      ? prisma.checklist.findMany({
          where: { id: { in: Array.from(checklistIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    userIds.size > 0
      ? prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ])

  // Build lookup maps
  const docMap = new Map(documents.map((d) => [d.id, d.name]))
  const checkMap = new Map(checklists.map((c) => [c.id, c.name]))
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  // Enrich logs with resource names
  const enriched = logs.map((log) => {
    let resourceName: string | null = null

    if (log.resourceId) {
      switch (log.resourceType) {
        case "document":
          resourceName = docMap.get(log.resourceId) || null
          break
        case "checklist":
          resourceName = checkMap.get(log.resourceId) || null
          break
        case "user":
          resourceName = userMap.get(log.resourceId) || null
          break
      }
    }

    return {
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      resourceName,
      metadata: log.metadata,
      user: log.user,
      createdAt: log.createdAt,
    }
  })

  return enriched
}
