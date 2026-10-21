import { expect, it } from "vitest"
import { boundedFormData } from "@/lib/request-body"
it("rejects oversized declared uploads before reading them", async () => {
  const request = new Request("http://localhost", { method: "POST", headers: { "Content-Length": "1000" }, body: "x" })
  await expect(boundedFormData(request, 100)).rejects.toThrow("too large")
})
it("rejects oversized uploads even without a declared size", async () => {
  const request = new Request("http://localhost", { method: "POST", body: "x".repeat(101) })
  await expect(boundedFormData(request, 100)).rejects.toThrow("too large")
})
it("preserves a valid multipart payload", async () => {
  const data = new FormData(); data.set("name", "Policy")
  const result = await boundedFormData(new Request("http://localhost", { method: "POST", body: data }), 10000)
  expect(result.get("name")).toBe("Policy")
})
