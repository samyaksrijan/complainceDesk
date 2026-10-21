import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ session: vi.fn(), user: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() }, token: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() }, send: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { user: mocks.user, passwordResetToken: mocks.token, $transaction: async (fn: (tx: { user: typeof mocks.user; passwordResetToken: typeof mocks.token }) => unknown) => fn({ user: mocks.user, passwordResetToken: mocks.token }) } }))
vi.mock("next-auth", () => ({ getServerSession: mocks.session }))
vi.mock("@/services/email", () => ({ sendAccountLink: mocks.send }))
import { consumePasswordLink, issuePasswordLink } from "@/services/password-reset"
import { withAdmin } from "@/lib/rbac"
import { authOptions } from "@/lib/auth"
import { registerSchema } from "@/lib/validation"
import { validateRuntimeEnvironment } from "@/lib/config"
beforeEach(() => { mocks.token.deleteMany.mockResolvedValue({ count: 1 }); mocks.user.update.mockResolvedValue({}) })
describe("account security", () => {
  it("issuing a recovery link never overwrites the password", async () => {
    await issuePasswordLink({ id: "u1", email: "member@example.com", name: "Member" })
    expect(mocks.user.update).not.toHaveBeenCalled()
    expect(mocks.token.create.mock.calls[0][0].data.tokenHash).toHaveLength(64)
    expect(mocks.send.mock.calls[0][2]).not.toBe(mocks.token.create.mock.calls[0][0].data.tokenHash)
  })
  it("rejects expired recovery links", async () => {
    mocks.token.findUnique.mockResolvedValue({ user: { status: "ACTIVE" }, expiresAt: new Date(0) })
    expect(await consumePasswordLink("x".repeat(64), "StrongPassword123")).toBe(false)
    expect(mocks.user.update).not.toHaveBeenCalled()
  })
  it("consumes a valid token exactly once before updating the password", async () => {
    mocks.token.findUnique.mockResolvedValue({ userId: "u1", user: { status: "ACTIVE" }, expiresAt: new Date(Date.now()+60000) })
    mocks.token.deleteMany.mockResolvedValueOnce({ count: 1 })
    expect(await consumePasswordLink("x".repeat(64), "StrongPassword123")).toBe(true)
    expect(mocks.user.update.mock.calls[0][0].data.passwordChangedAt).toBeInstanceOf(Date)
    mocks.token.deleteMany.mockResolvedValueOnce({ count: 0 })
    expect(await consumePasswordLink("x".repeat(64), "StrongPassword123")).toBe(false)
  })
  it("denies unauthenticated and non-admin requests", async () => {
    const handler = withAdmin(async () => new Response("ok"))
    const context = { params: Promise.resolve({}) }
    mocks.session.mockResolvedValue(null)
    expect((await handler(new Request("http://localhost"), context)).status).toBe(401)
    mocks.session.mockResolvedValue({ user: { id: "u1", role: "VIEWER" } })
    expect((await handler(new Request("http://localhost"), context)).status).toBe(403)
  })
  it("revokes disabled accounts and sessions after a password change", async () => {
    const jwt = authOptions.callbacks!.jwt!
    const input = { token: { userId: "u1", authenticatedAt: 1 }, trigger: "update", session: {} } as Parameters<typeof jwt>[0]
    mocks.user.findUnique.mockResolvedValue({ status: "INACTIVE" })
    expect((await jwt(input)).invalid).toBe(true)
    mocks.user.findUnique.mockResolvedValue({ status: "ACTIVE", passwordChangedAt: new Date(), org: { name: "Org" } })
    expect((await jwt(input)).invalid).toBe(true)
  })
  it("fails fast for unsafe production configuration", () => {
    expect(() => validateRuntimeEnvironment({ NODE_ENV: "production" })).toThrow("Missing production configuration")
  })
  it("rejects bcrypt-truncated passwords and empty sanitized names", () => {
    const input = { email: "valid@example.com", name: "Valid User", orgName: "Organization", password: "StrongPassword123" }
    expect(registerSchema.safeParse({ ...input, password: "A1" + "😀".repeat(30) }).success).toBe(false)
    expect(registerSchema.safeParse({ ...input, name: "<b></b>" }).success).toBe(false)
  })

})
