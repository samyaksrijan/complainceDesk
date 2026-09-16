/**
 * Test Script: Phase B4b — Value Extraction via LLM
 *
 * Run: npx ts-node scripts/test-extract-values.ts
 *
 * Prerequisites:
 *   1. Docker PostgreSQL running
 *   2. npm run dev running on :3000
 *   3. GROQ_API_KEY set in .env
 *   4. Database seeded (has checklist templates)
 *   5. A document has been uploaded (we upload one in the test)
 */

const BASE = "http://localhost:3000/api"
const fs = require("fs")
const path = require("path")

interface TestResult {
  name: string
  passed: boolean
  detail: string
}

const results: TestResult[] = []
let adminCookie = ""
let viewerCookie = ""

function log(msg: string) { console.log(msg) }

function addResult(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail })
  const icon = passed ? "PASS" : "FAIL"
  log(`  [${icon}] ${name}: ${detail}`)
}

async function loginAs(email: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/auth/csrf`)
  const csrfData = await csrfRes.json()
  const csrfCookie = csrfRes.headers.get("set-cookie")?.split(";")[0] || ""

  const res = await fetch(`${BASE}/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookie,
    },
    body: new URLSearchParams({
      email, password,
      csrfToken: csrfData.csrfToken,
      json: "true",
    }),
    redirect: "manual",
  })
  const cookies = res.headers.getSetCookie()
  return cookies
    .filter((c: string) => c.startsWith("next-auth.session-token"))
    .map((c: string) => c.split(";")[0])
    .join("; ")
}

async function uploadAndGetId(cookie: string): Promise<string> {
  const testFile = path.join(process.cwd(), "test-files", "sample-audit.txt")
  const fileBuffer = fs.readFileSync(testFile)
  const boundary = "----FormBoundary" + Date.now()
  const textPart = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="name"\r\n\r\n` +
    `Building Audit Test\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="sample-audit.txt"\r\n` +
    `Content-Type: text/plain\r\n\r\n`,
    "utf-8"
  )
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8")
  const body = Buffer.concat([textPart, fileBuffer, endPart])

  const res = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Cookie: cookie,
    },
    body,
  })
  const data = await res.json()
  return data.id
}

async function api(path: string, opts: any = {}): Promise<any> {
  const headers: any = { "Content-Type": "application/json" }
  if (opts.cookie) headers.Cookie = opts.cookie
  const fetchOpts: any = { method: opts.method || "GET", headers }
  if (opts.body) fetchOpts.body = JSON.stringify(opts.body)
  const res = await fetch(`${BASE}${path}`, fetchOpts)
  let data = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

async function testExtractValues() {
  log("\n--- Test: Extract Values ---")

  // Upload a test document
  log("  Uploading test document...")
  const docId = await uploadAndGetId(adminCookie)
  addResult(
    "0.1 Test document uploaded",
    !!docId,
    `Document ID: ${docId}`
  )

  // Get a checklist ID (use Building Safety template)
  const checklists = await api("/checklists?isTemplate=true&category=building", { cookie: adminCookie })
  const checklistId = checklists.data?.checklists?.[0]?.id
  addResult(
    "0.2 Found Building Safety checklist",
    !!checklistId,
    `Checklist ID: ${checklistId}`
  )

  // 1.1: Extract values
  log("\n  (calling LLM for value extraction — may take 5-15 seconds...)")
  const extract = await fetch(`${BASE}/scan/extract-values`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ documentId: docId, checklistId }),
  })

  const data = await extract.json()

  addResult(
    "1.1 Extract values returns 200",
    extract.status === 200,
    `Status: ${extract.status}`
  )

  addResult(
    "1.2 Response has extractions array",
    Array.isArray(data.extractions) && data.extractions.length > 0,
    `Extractions: ${data.extractions?.length || 0}`
  )

  addResult(
    "1.3 Response has meta info",
    !!data.meta?.provider && !!data.meta?.documentName,
    `Provider: ${data.meta?.provider}, Doc: ${data.meta?.documentName}`
  )

  // Check each extraction has required fields
  const extractions = data.extractions || []
  let allValid = true
  extractions.forEach((e: any, i: number) => {
    if (!e.field_name) allValid = false
    if (e.found === undefined || e.found === null) allValid = false
  })

  addResult(
    "1.4 All extractions have field_name and found",
    allValid,
    allValid ? "All valid" : "Some extractions missing fields"
  )

  // Check that found values make sense
  const foundItems = extractions.filter((e: any) => e.found === true)
  const notFoundItems = extractions.filter((e: any) => e.found === false)

  addResult(
    "1.5 At least some values were found",
    foundItems.length > 0,
    `Found: ${foundItems.length}, Not found: ${notFoundItems.length}`
  )

  addResult(
    "1.6 Found items have extracted_value",
    foundItems.every((e: any) => e.extracted_value !== null && e.extracted_value !== undefined),
    `Items with value: ${foundItems.filter((e: any) => e.extracted_value).length}/${foundItems.length}`
  )

  addResult(
    "1.7 Found items have source_excerpt",
    foundItems.filter((e: any) => e.source_excerpt && e.source_excerpt.length > 10).length >= foundItems.length * 0.5,
    `Items with excerpt: ${foundItems.filter((e: any) => e.source_excerpt).length}/${foundItems.length}`
  )

  // Print extracted values for visual inspection
  log("\n  Extracted values:")
  extractions.forEach((e: any, i: number) => {
    const status = e.found ? "FOUND" : "NOT FOUND"
    log(`    ${i + 1}. ${e.field_name}`)
    log(`       Status: ${status}`)
    log(`       Value: ${e.extracted_value || "null"}`)
    log(`       Excerpt: "${(e.source_excerpt || "").substring(0, 80)}..."`)
    if (e.note) log(`       Note: ${e.note}`)
  })

  // Clean up
  await api(`/documents/${docId}`, { method: "DELETE", cookie: adminCookie })
}

async function testExtractValidation() {
  log("\n--- Test: Extract Validation ---")

  // 2.1: Missing documentId
  const noDoc = await fetch(`${BASE}/scan/extract-values`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ checklistId: "some_id" }),
  })

  addResult(
    "2.1 Reject missing documentId",
    noDoc.status === 400,
    `Status: ${noDoc.status}`
  )

  // 2.2: Missing checklistId
  const noChecklist = await fetch(`${BASE}/scan/extract-values`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ documentId: "some_id" }),
  })

  addResult(
    "2.2 Reject missing checklistId",
    noChecklist.status === 400,
    `Status: ${noChecklist.status}`
  )

  // 2.3: Non-existent document
  const badDoc = await fetch(`${BASE}/scan/extract-values`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ documentId: "nonexistent", checklistId: "nonexistent" }),
  })

  addResult(
    "2.3 Non-existent document returns 404",
    badDoc.status === 404,
    `Status: ${badDoc.status}`
  )

  // 2.4: Viewer cannot extract
  const viewerExtract = await fetch(`${BASE}/scan/extract-values`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: viewerCookie,
    },
    body: JSON.stringify({ documentId: "some", checklistId: "some" }),
  })

  addResult(
    "2.4 Viewer CANNOT extract (403)",
    viewerExtract.status === 403,
    `Status: ${viewerExtract.status}`
  )
}

async function runAllTests() {
  log("========================================")
  log("  PHASE B4b TEST: Value Extraction")
  log("========================================")
  log("")
  log("NOTE: This test calls the LLM API. It requires:")
  log("  - Valid GROQ_API_KEY in .env")
  log("  - Internet connection")
  log("  - Each LLM call takes 5-15 seconds")
  log("")

  try {
    log("Logging in...")
    adminCookie = await loginAs("admin@demo.com", "password123")
    viewerCookie = await loginAs("viewer@demo.com", "password123")

    if (!adminCookie || !viewerCookie) {
      log("\nERROR: Failed to obtain session cookies.")
      process.exit(1)
    }
    log("Sessions obtained.\n")

    await testExtractValues()
    await testExtractValidation()
  } catch (error) {
    log(`\nFATAL ERROR: ${error}`)
    console.error(error)
  }

  log("\n========================================")
  log("  RESULTS SUMMARY")
  log("========================================")

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const total = results.length

  log(`  Total: ${total}`)
  log(`  Passed: ${passed}`)
  log(`  Failed: ${failed}`)
  log("")

  if (failed > 0) {
    log("  FAILED TESTS:")
    results.filter((r) => !r.passed).forEach((r) => {
      log(`    - ${r.name}: ${r.detail}`)
    })
    log("")
  }

  if (failed === 0) {
    log("  ALL TESTS PASSED")
  } else {
    log("  SOME TESTS FAILED — FIX BEFORE PROCEEDING")
    process.exit(1)
  }
}

runAllTests()
