import { afterEach, describe, expect, it, vi } from "vitest"
import { mkdtemp, rm, readFile as readDisk } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock("@aws-sdk/client-s3", async importOriginal => {
  const real = await importOriginal<typeof import("@aws-sdk/client-s3")>()
  return { ...real, S3Client: class { send = mocks.send } }
})
import { saveFile, readFile, deleteFile } from "@/services/storage"
import { extractText } from "@/services/extraction"
let root = ""
afterEach(async () => { vi.unstubAllEnvs(); if (root) await rm(root, { recursive: true, force: true }); root = "" })
describe("storage and extraction", () => {
  it("round trips local files and rejects escaping paths", async () => {
    root = await mkdtemp(join(tmpdir(), "compliance-storage-")); vi.stubEnv("UPLOAD_DIR", root); vi.stubEnv("STORAGE_DRIVER", "local")
    const file = await saveFile("org-1", "policy.txt", Buffer.from("Policy text"))
    expect((await readFile(file)).toString()).toBe("Policy text")
    await expect(saveFile("../escape", "x.txt", Buffer.from("x"))).rejects.toThrow("Invalid organization")
    await expect(readFile("/etc/passwd")).rejects.toThrow("Invalid storage path")
    expect(await deleteFile(file)).toBe(true)
  })
  it("stores private encrypted S3 objects and reads them through the SDK", async () => {
    vi.stubEnv("STORAGE_DRIVER", "s3"); vi.stubEnv("S3_BUCKET", "test-private-bucket")
    mocks.send.mockResolvedValueOnce({})
    const file = await saveFile("org-1", "policy.txt", Buffer.from("binary"))
    expect(file).toMatch(/^s3:\/\/test-private-bucket\/org-1\//)
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({ Bucket: "test-private-bucket", ServerSideEncryption: "AES256", Body: Buffer.from("binary") })
    mocks.send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => Buffer.from("binary") } })
    expect((await readFile(file)).toString()).toBe("binary")
    await expect(readFile("s3://another-bucket/private.txt")).rejects.toThrow("Invalid object location")
  })
  it("extracts a real PDF using pdf-parse v2", async () => {
    root = await mkdtemp(join(tmpdir(), "compliance-pdf-")); vi.stubEnv("UPLOAD_DIR", root); vi.stubEnv("STORAGE_DRIVER", "local")
    const bytes = await readDisk("Data Protection and Information Security Policy v2.4.pdf")
    const file = await saveFile("org-1", "policy.pdf", bytes)
    const result = await extractText(file, "pdf")
    expect(result.error).toBeUndefined()
    expect(result.text.length).toBeGreaterThan(100)
  })
  it("extracts a real DOCX policy", async () => {
    root = await mkdtemp(join(tmpdir(), "compliance-docx-")); vi.stubEnv("UPLOAD_DIR", root); vi.stubEnv("STORAGE_DRIVER", "local")
    const file = await saveFile("org-1", "policy.docx", await readDisk("tests/fixtures/policy.docx"))
    const result = await extractText(file, "docx")
    expect(result.error).toBeUndefined()
    expect(result.text).toContain("annual security training")
  })

})
