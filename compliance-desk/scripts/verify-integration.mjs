// Uses an isolated PostgreSQL-compatible WASM engine, or an explicitly supplied disposable CI PostgreSQL database.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:http"
import { mkdtemp, rm, cp, mkdir, access, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { chromium } from "playwright"

const work = await mkdtemp(path.join(tmpdir(), "compliance-integration-"))
const base = "http://127.0.0.1:3417"
const external = process.env.TEST_DATABASE_URL
if (external && !new URL(external).pathname.startsWith("/compliance_test")) throw new Error("TEST_DATABASE_URL must name a disposable compliance_test database")
const db = external ? null : await PGlite.create()
const pg = db ? new PGLiteSocketServer({ db, port: 15438, host: "127.0.0.1" }) : null

const emails = []
const ai = createServer(async (req, res) => {
  let input = ""; for await (const chunk of req) input += chunk
  const body = JSON.parse(input)
  if (req.url.includes("outbound-emails")) {
    emails.push(body)
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ MessageId: "local-test-message" })); return
  }
  const text = body.messages.at(-1).content
  const names = [...text.matchAll(/\d+\. "([^"]+)"/g)].map(match => match[1])
  const content = body.response_format ? JSON.stringify({ extractions: names.map((name, i) => ({ field_name: name, found: i === 0, extracted_value: i === 0 ? "42" : null, source_excerpt: i === 0 ? "The building height is 42 meters." : null })) }) : "One requirement passed. Four requirements were not found. The document is noncompliant."
  res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ id: "test", choices: [{ message: { content } }] }))
})
let app, browser
let logs = ""
async function run(command, args, env) {
  const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] })
  let output = ""; child.stdout.on("data", c => output += c); child.stderr.on("data", c => output += c)
  const [code] = await once(child, "exit"); assert.equal(code, 0, output)
}
async function api(request, route, options = {}, expected = 200) {
  const response = await request.fetch(base + route, options)
  assert.equal(response.status(), expected, `${route}: ${await response.text()}`)
  if (expected === 204) return null
  return response.json()
}
try {
  if (pg) await pg.start()
  ai.listen(0, "127.0.0.1"); await once(ai, "listening")
  const env = { ...process.env, DATABASE_URL: external || "postgresql://postgres:postgres@127.0.0.1:15438/postgres?sslmode=disable&connection_limit=1", PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1", NEXTAUTH_URL: base, NEXTAUTH_SECRET: randomBytes(32).toString("hex"), NODE_ENV: "production", ALLOW_LOCAL_STORAGE: "true", ALLOW_HTTP: "true", STORAGE_DRIVER: "local", UPLOAD_DIR: path.join(work, "uploads"), GROQ_API_KEY: "local-test-only", GROQ_BASE_URL: `http://127.0.0.1:${ai.address().port}/openai/v1`, LLM_PRIMARY_PROVIDER: "groq", LLM_FALLBACK_PROVIDER: "groq", AWS_REGION: "ap-south-1", EMAIL_FROM: "test@example.invalid", SES_ENDPOINT: `http://127.0.0.1:${ai.address().port}`, AWS_ACCESS_KEY_ID: "test-only-key", AWS_SECRET_ACCESS_KEY: "test-only-secret", AWS_PROFILE: "", AWS_SESSION_TOKEN: "", AWS_EC2_METADATA_DISABLED: "true", GEMINI_API_KEY: "", TRUST_PROXY: "false", TESSERACT_LANG_PATH: process.env.TEST_TESSERACT_LANG_PATH || "" }
  await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], env)
  await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-url", env.DATABASE_URL, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"], env)
  await mkdir(".next/standalone/.next", { recursive: true })
  await cp(".next/static", ".next/standalone/.next/static", { recursive: true })
  await cp("public", ".next/standalone/public", { recursive: true })
  app = spawn(process.execPath, [".next/standalone/server.js"], { env: { ...env, PORT: "3417", HOSTNAME: "127.0.0.1" }, stdio: ["ignore", "pipe", "pipe"] })
  app.stdout.on("data", c => { logs += c }); app.stderr.on("data", c => { logs += c })
  let ready = false
  for (let n = 0; n < 120; n++) {
    try { if ((await fetch(base + "/api/health")).ok) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert(ready, logs)
  const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  const available = await access(chrome).then(() => true).catch(() => false)
  browser = await chromium.launch({ headless: true, ...(available ? { executablePath: chrome } : {}) })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []; page.on("pageerror", error => errors.push(error.message))
  await api(context.request, "/api/notifications", { method: "POST", data: { title: "spoof" } }, 401)
  await page.goto(base + "/login")
  await page.locator("#email").fill("admin@demo.com"); await page.locator("#password").fill("password123")
  await page.getByRole("button", { name: /authenticate|sign in|access workspace/i }).click()
  await page.getByText("Invalid email or password", { exact: true }).waitFor()
  await api(context.request, "/api/auth/register", { method: "POST", data: { name: "Test Administrator", email: "admin@integration.invalid", password: "Integration123!", orgName: "Integration Organization" } }, 201)
  await page.goto(base + "/login")
  await page.locator("#email").fill("admin@integration.invalid")
  await page.locator("#password").fill("Integration123!")
  await page.getByRole("button", { name: /authenticate|sign in|access workspace/i }).click()
  await page.waitForURL("**/dashboard")
  await page.getByRole("button", { name: "Dismiss onboarding" }).click({ timeout: 5000 })
  for (const [fixture, mimeType] of [["Data Protection and Information Security Policy v2.4.pdf", "application/pdf"], ["tests/fixtures/policy.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]]) {
    const parsed = await api(context.request, "/api/documents/upload", { method: "POST", multipart: { name: "Parser fixture", file: { name: path.basename(fixture), mimeType, buffer: await readFile(fixture) } } }, 201)
    assert(!parsed.extractionError, parsed.extractionError)
    assert(parsed.extractedText.length > 30)
    await api(context.request, `/api/documents/${parsed.id}`, { method: "DELETE" }, 204)
  }
  if (process.env.TEST_TESSERACT_LANG_PATH) {
    const parsed = await api(context.request, "/api/documents/upload", { method: "POST", multipart: { name: "OCR fixture", file: { name: "policy.png", mimeType: "image/png", buffer: await readFile("tests/fixtures/policy.png") } } }, 201)
    assert(!parsed.extractionError, parsed.extractionError)
    assert.match(parsed.extractedText, /SAFETY TRAINING/i)
    await api(context.request, `/api/documents/${parsed.id}`, { method: "DELETE" }, 204)
  }
  const stats = await api(context.request, "/api/dashboard/stats")
  assert.equal(stats.stats.totalDocuments, 0)
  const items = Array.from({ length: 5 }, (_,i) => ({ fieldName: i ? `Missing control ${i}` : "Building height", fieldType: "NUMBER", condition: "LESS_THAN", thresholdValue: 50, sortOrder: i }))
  const checklist = await api(context.request, "/api/checklists", { method: "POST", data: { name: "Integration Safety", items } }, 201)
  await page.goto(base + "/documents")
  await page.getByRole("button", { name: "Ingest Document" }).click()
  await page.locator('input[type="file"]').setInputFiles("test-files/sample-audit.txt")
  await page.getByRole("button", { name: /upload|ingest/i }).last().click()
  await page.waitForTimeout(1500)
  const documents = await api(context.request, "/api/documents")
  assert.equal(documents.documents.length, 1)
  const document = documents.documents[0]
  await api(context.request, `/api/documents/${document.id}/match`, { method: "POST", data: { checklistId: checklist.id } })
  const result = await api(context.request, `/api/documents/${document.id}/check`, { method: "POST", data: {} })
  assert.equal(result.overallScore, 20); assert.equal(result.notFoundItems, 4)
  const detail = await api(context.request, `/api/documents/${document.id}`)
  assert.equal(detail.status, "NON_COMPLIANT"); assert.equal(detail.results[0].items[0].fieldName, "Building height")
  const pdf = await context.request.get(base + `/api/documents/${document.id}/results/pdf`)
  assert.equal(pdf.status(), 200, await pdf.text()); assert.equal(pdf.headers()["content-type"], "application/pdf")
  assert.equal((await pdf.body()).subarray(0,4).toString(), "%PDF")
  const report = await api(context.request, "/api/reports/generate", { method: "POST", data: { name: "Integration Report", includeDetails: true, includeRecommendations: true } }, 201)
  const reportDetail = await api(context.request, `/api/reports/${report.reportId}`)
  assert.equal(reportDetail.summary.averageScore, 20)
  await page.goto(base + `/documents/${document.id}`)
  await page.getByText("Building height", { exact: true }).first().waitFor()
  await page.goto(base + "/dashboard")
  await page.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Mobile page must not overflow horizontally")
  await page.screenshot({ path: "test-results/dashboard-mobile.png", fullPage: true })
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await page.getByRole("link", { name: "Settings", exact: true }).click()
  await page.waitForURL("**/settings")
  await page.getByRole("dialog").waitFor({ state: "hidden" })
  const preferences = await api(context.request, "/api/users/me", { method: "PUT", data: { name: "Updated Administrator", weeklyDigest: true } })
  assert.equal(preferences.weeklyDigest, true)
  assert.equal((await api(context.request, "/api/users/me")).weeklyDigest, true)
  const invitation = await api(context.request, "/api/admin/users/invite", { method: "POST", data: { name: "Test Viewer", email: "viewer@integration.invalid", role: "VIEWER" } }, 201)
  const inviteToken = new URL(emails.at(-1).Content.Simple.Body.Text.Data.match(/http[^\s]+/)[0]).searchParams.get("token")
  await api(context.request, "/api/auth/reset-password", { method: "POST", data: { token: inviteToken, newPassword: "ViewerPassword123!" } })
  await api(context.request, "/api/auth/reset-password", { method: "POST", data: { token: inviteToken, newPassword: "ReplayPassword123!" } }, 400)
  const viewer = await browser.newContext(); const viewerPage = await viewer.newPage()
  await viewerPage.goto(base + "/login"); await viewerPage.locator("#email").fill("viewer@integration.invalid"); await viewerPage.locator("#password").fill("ViewerPassword123!")
  await viewerPage.getByRole("button", { name: /authenticate|sign in|access workspace/i }).click(); await viewerPage.waitForURL("**/dashboard")
  await api(viewer.request, `/api/documents/${document.id}`)
  await api(viewer.request, `/api/documents/${document.id}/check`, { method: "POST", data: {} }, 403)
  await api(viewer.request, "/api/admin/users", {}, 403)
  await api(viewer.request, "/api/audit-log", {}, 403)
  await api(context.request, `/api/admin/users/${invitation.user.id}/status`, { method: "PUT", data: { status: "INACTIVE" } })
  await api(viewer.request, "/api/documents", {}, 401)
  await viewer.close()
  const audit = await api(context.request, "/api/audit-log"); assert(audit.logs.length > 0)
  const notices = await api(context.request, "/api/notifications"); assert(notices.items.length > 0)
  await api(context.request, `/api/notifications/${notices.items[0].id}`, { method: "DELETE" }, 204)
  // An independent organization cannot read or act on another tenant's records.
  const other = await browser.newContext()
  await api(other.request, "/api/auth/register", { method: "POST", data: { name: "Other Administrator", email: "other@integration.invalid", password: "Integration123!", orgName: "Other Organization" } }, 201)
  const otherPage = await other.newPage(); await otherPage.goto(base + "/login")
  await otherPage.locator("#email").fill("other@integration.invalid"); await otherPage.locator("#password").fill("Integration123!")
  await otherPage.getByRole("button", { name: /authenticate|sign in|access workspace/i }).click(); await otherPage.waitForURL("**/dashboard")
  await api(other.request, `/api/documents/${document.id}`, {}, 404)
  await api(other.request, `/api/reports/${report.reportId}`, {}, 404)
  await api(other.request, `/api/documents/${document.id}/check`, { method: "POST", data: {} }, 404)
  await api(other.request, "/api/reports/generate", { method: "POST", data: { name: "Foreign report", checklistId: checklist.id } }, 404)
  await api(other.request, "/api/reports/generate", { method: "POST", data: { name: "Empty report" } }, 422)
  await other.close()
  await api(context.request, `/api/documents/${document.id}`, { method: "DELETE" }, 204)
  assert.equal((await api(context.request, "/api/documents")).documents.length, 0)
  assert.deepEqual(errors, [], "Browser runtime errors")
  console.log("PASS: migrations/schema consistency, registration/login, onboarding, PDF/DOCX/TXT ingestion, optional PNG OCR, upload UI, matching, 20% scoring, PDF export, reports, dashboard/mobile navigation, settings, invitations/reset replay rejection, role revocation, audit trail, notifications, tenant isolation and deletion against the isolated test database + mocked AI.")
} catch (error) { console.error(logs.slice(-6000)); throw error }
finally {
  if (browser) await browser.close()
  if (app) { app.kill("SIGTERM"); await once(app, "exit").catch(() => {}) }
  ai.close()
  if (pg) await pg.stop().catch(() => {})
  if (db) await db.close()
  await rm(work, { recursive: true, force: true })
}
