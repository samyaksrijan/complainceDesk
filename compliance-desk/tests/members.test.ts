import { beforeEach, expect, it, vi } from "vitest"
const tx = vi.hoisted(() => ({ $queryRaw: vi.fn(), user: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn() }, activityLog: { create: vi.fn() }, notification: { create: vi.fn() } }))
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (transaction: typeof tx) => unknown) => fn(tx) } }))
import { updateMember } from "@/services/members"
const actor = { id: "actor", orgId: "org", orgName: "Organization", email: "admin@example.com", name: "Administrator", role: "ADMIN" }
beforeEach(() => { vi.resetAllMocks(); tx.user.findFirst.mockResolvedValueOnce({ id: "actor", status: "ACTIVE", role: "ADMIN" }) })
it("rechecks actor access after acquiring the organization lock", async () => {
  tx.user.findFirst.mockReset().mockResolvedValue(null)
  expect(await updateMember(actor, "target", { status: "INACTIVE" })).toMatchObject({ status: 403 })
  expect(tx.$queryRaw).toHaveBeenCalled()
  expect(tx.user.update).not.toHaveBeenCalled()
})
it("protects the last administrator", async () => {
  tx.user.findFirst.mockResolvedValueOnce({ id: "target", status: "ACTIVE", role: "ADMIN" })
  tx.user.count.mockResolvedValue(1)
  expect(await updateMember(actor, "target", { status: "DELETED" })).toMatchObject({ status: 409 })
  expect(tx.user.update).not.toHaveBeenCalled()
})
it("does not disclose password hashes in membership responses", async () => {
  tx.user.findFirst.mockResolvedValueOnce({ id: "target", status: "ACTIVE", role: "VIEWER" })
  tx.user.update.mockResolvedValue({ id: "target", status: "INACTIVE", role: "VIEWER" })
  expect(await updateMember(actor, "target", { status: "INACTIVE" })).toMatchObject({ status: 200 })
  expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, name: true, email: true, role: true, status: true } }))
  expect(tx.activityLog.create).toHaveBeenCalled()
})
