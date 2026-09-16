/**
 * Test Script: Phase B5 — Compliance Engine
 *
 * Run: npx ts-node scripts/test-compliance.ts
 *
 * Prerequisites:
 *   1. Docker PostgreSQL running
 *   2. npm run dev running on :3000
 *   3. GROQ_API_KEY set in .env
 *   4. Database seeded
 *   5. test-files/sample-audit.txt exists
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
let docId = ""
let checklistId = ""
let resultId = ""

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
      "Cookie": csrfCookie
    },
    body: new URLSearchParams({ email, password, csrfToken: csrfData.csrfToken, json: "true" }),
    redirect: "manual",
  })
  const cookies = res.headers.getSetCookie()
  return cookies.filter((c: string) => c.startsWith("next-auth.session-token")).map((c: string) => c.split(";")[0]).join("; ")
}

async function uploadDoc(cookie: string): Promise<string> {
  const testFile = path.join(process.cwd(), "test-files", "sample-audit.txt")
  const fileBuffer = fs.readFileSync(testFile)
  const boundary = "----FormBoundary" + Date.now()
  const textPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nBuilding Audit Test\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample-audit.txt"\r\nContent-Type: text/plain\r\n\r\n`,
    "utf-8"
  )
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8")
  const body = Buffer.concat([textPart, fileBuffer, endPart])
  const res = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, Cookie: cookie },
    body,
  })
  const data = await res.json()
  return data.id
}

async function api(p: string, opts: any = {}): Promise<any> {
  const headers: any = { "Content-Type": "application/json" }
  if (opts.cookie) headers.Cookie = opts.cookie
  const fetchOpts: any = { method: opts.method || "GET", headers }
  if (opts.body) fetchOpts.body = JSON.stringify(opts.body)
  const res = await fetch(`${BASE}${p}`, fetchOpts)
  let data = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

// ============================================
// TEST GROUPS
// ============================================

async function testMatch() {
  log("\n--- Test: Match Document to Checklist ---")

  // 1.1: Manual match
  log("  Matching document to Building Safety checklist...")
  const match = await api(`/documents/${docId}/match`, {
    method: "POST",
    cookie: adminCookie,
    body: { checklistId },
  })

  addResult(
    "1.1 Manual match returns 200",
    match.status === 200,
    `Status: ${match.status}`
  )

  addResult(
    "1.2 Match is successful",
    match.data?.matched === true,
    `Matched: ${match.data?.matched}`
  )

  addResult(
    "1.3 Match type is manual",
    match.data?.matchType === "manual",
    `Type: ${match.data?.matchType}`
  )

  addResult(
    "1.4 Checklist name returned",
    !!match.data?.checklistName,
    `Name: ${match.data?.checklistName}`
  )

  // Verify document status updated
  const docDetail = await api(`/documents/${docId}`, { cookie: adminCookie })
  addResult(
    "1.5 Document status updated to MATCHED",
    docDetail.data?.status === "MATCHED",
    `Status: ${docDetail.data?.status}`
  )

  addResult(
    "1.6 Document has matchedChecklist",
    !!docDetail.data?.matchedChecklist?.id,
    `Checklist: ${docDetail.data?.matchedChecklist?.name}`
  )
}

async function testAutoMatch() {
  log("\n--- Test: Auto-Match ---")

  // Upload a new document for auto-match test
  const autoDocId = await uploadDoc(adminCookie)

  // 2.1: Auto-match (no checklistId)
  log("  Running auto-match (keyword-based)...")
  const autoMatch = await api(`/documents/${autoDocId}/match`, {
    method: "POST",
    cookie: adminCookie,
  })

  addResult(
    "2.1 Auto-match returns 200",
    autoMatch.status === 200,
    `Status: ${autoMatch.status}`
  )

  addResult(
    "2.2 Auto-match returns suggestions",
    Array.isArray(autoMatch.data?.suggestions) && autoMatch.data.suggestions.length > 0,
    `Suggestions: ${autoMatch.data?.suggestions?.length || 0}`
  )

  addResult(
    "2.3 Auto-match has confidence score",
    typeof autoMatch.data?.confidence === "number",
    `Confidence: ${autoMatch.data?.confidence}`
  )

  // Clean up
  await api(`/documents/${autoDocId}`, { method: "DELETE", cookie: adminCookie })
}

async function testMatchValidation() {
  log("\n--- Test: Match Validation ---")

  // 3.1: Non-existent document
  const notFound = await api("/documents/nonexistent/match", {
    method: "POST",
    cookie: adminCookie,
  })
  addResult("3.1 Non-existent document returns 404", notFound.status === 404, `Status: ${notFound.status}`)

  // 3.2: Viewer cannot match
  const viewerMatch = await api(`/documents/${docId}/match`, {
    method: "POST",
    cookie: viewerCookie,
    body: { checklistId },
  })
  addResult("3.2 Viewer CANNOT match (403)", viewerMatch.status === 403, `Status: ${viewerMatch.status}`)

  // 3.3: Non-existent checklist
  const badChecklist = await api(`/documents/${docId}/match`, {
    method: "POST",
    cookie: adminCookie,
    body: { checklistId: "nonexistent" },
  })
  addResult("3.3 Non-existent checklist returns 404", badChecklist.status === 404, `Status: ${badChecklist.status}`)
}

async function testComplianceCheck() {
  log("\n--- Test: Compliance Check ---")
  log("  (calling LLM — may take 10-30 seconds...)")

  // 4.1: Run compliance check
  const check = await api(`/documents/${docId}/check`, {
    method: "POST",
    cookie: adminCookie,
  })

  addResult(
    "4.1 Compliance check returns 200",
    check.status === 200,
    `Status: ${check.status}`
  )

  addResult(
    "4.2 Has overall score",
    typeof check.data?.overallScore === "number" && check.data.overallScore >= 0,
    `Score: ${check.data?.overallScore}%`
  )

  addResult(
    "4.3 Has item counts",
    typeof check.data?.totalItems === "number" && check.data.totalItems > 0,
    `Total: ${check.data?.totalItems}, Passed: ${check.data?.passedItems}, Failed: ${check.data?.failedItems}`
  )

  addResult(
    "4.4 Has summary text",
    typeof check.data?.summary === "string" && check.data.summary.length > 20,
    `Summary: "${check.data?.summary?.substring(0, 80)}..."`
  )

  addResult(
    "4.5 Has items array",
    Array.isArray(check.data?.items) && check.data.items.length > 0,
    `Items: ${check.data?.items?.length}`
  )

  // Check each item
  const items = check.data?.items || []
  const validStatuses = ["PASS", "FAIL", "NOT_FOUND", "NEEDS_REVIEW"]
  const allValidStatuses = items.every((item: any) => validStatuses.includes(item.status))

  addResult(
    "4.6 All items have valid status",
    allValidStatuses,
    allValidStatuses ? "All valid" : `Invalid: ${items.filter((i: any) => !validStatuses.includes(i.status)).map((i: any) => i.status).join(", ")}`
  )

  // Score should be reasonable (our test data should pass most items)
  addResult(
    "4.7 Score is reasonable (>= 50%)",
    check.data?.overallScore >= 50,
    `Score: ${check.data?.overallScore}% (expected high for matching data)`
  )

  // Check items have fieldName
  const allHaveFieldName = items.every((item: any) => !!item.fieldName)
  addResult(
    "4.8 All items have fieldName",
    allHaveFieldName,
    allHaveFieldName ? "All valid" : "Some items missing fieldName"
  )

  // Check items have expected value
  const allHaveExpected = items.every((item: any) => !!item.expected)
  addResult(
    "4.9 All items have expected value",
    allHaveExpected,
    allHaveExpected ? "All valid" : "Some items missing expected"
  )

  // Verify document status updated
  const docDetail = await api(`/documents/${docId}`, { cookie: adminCookie })
  const expectedStatus = check.data?.overallScore >= 100 ? "COMPLIANT" : "NON_COMPLIANT"
  addResult(
    "4.10 Document status updated to COMPLIANT or NON_COMPLIANT",
    docDetail.data?.status === expectedStatus,
    `Status: ${docDetail.data?.status} (expected: ${expectedStatus})`
  )

  // Print results for visual inspection
  log("\n  Compliance results:")
  items.forEach((item: any, i: number) => {
    const icon = item.status === "PASS" ? "PASS" : item.status === "FAIL" ? "FAIL" : item.status === "NOT_FOUND" ? "N/F " : "REV "
    log(`    [${icon}] ${item.fieldName}`)
    log(`         Expected: ${item.expected} | Found: ${item.extractedValue || "N/A"}`)
    if (item.notes) log(`         Note: ${item.notes}`)
  })
}

async function testGetResults() {
  log("\n--- Test: Get Results ---")

  // 5.1: Get results
  const results = await api(`/documents/${docId}/results`, { cookie: adminCookie })

  addResult(
    "5.1 Get results returns 200",
    results.status === 200,
    `Status: ${results.status}`
  )

  addResult(
    "5.2 Results include checklist info",
    !!results.data?.checklist?.name,
    `Checklist: ${results.data?.checklist?.name}`
  )

  addResult(
    "5.3 Results include items",
    Array.isArray(results.data?.items) && results.data.items.length > 0,
    `Items: ${results.data?.items?.length}`
  )

  addResult(
    "5.4 Items include checklistItem details",
    !!results.data?.items?.[0]?.checklistItem?.fieldName,
    `First item: ${results.data?.items?.[0]?.checklistItem?.fieldName}`
  )

  addResult(
    "5.5 Results include generatedAt",
    !!results.data?.generatedAt,
    `Generated: ${results.data?.generatedAt}`
  )

  // 5.6: No results for new doc
  const newDocId = await uploadDoc(adminCookie)
  const noResults = await api(`/documents/${newDocId}/results`, { cookie: adminCookie })
  addResult(
    "5.6 Returns 404 for doc without results",
    noResults.status === 404,
    `Status: ${noResults.status}`
  )
  await api(`/documents/${newDocId}`, { method: "DELETE", cookie: adminCookie })
}

async function testCheckValidation() {
  log("\n--- Test: Check Validation ---")

  // 6.1: Document without match
  const unmatchDocId = await uploadDoc(adminCookie)
  const noMatch = await api(`/documents/${unmatchDocId}/check`, {
    method: "POST",
    cookie: adminCookie,
  })
  addResult(
    "6.1 Check without match returns 400",
    noMatch.status === 400,
    `Status: ${noMatch.status}`
  )
  await api(`/documents/${unmatchDocId}`, { method: "DELETE", cookie: adminCookie })

  // 6.2: Viewer cannot run check
  const viewerCheck = await api(`/documents/${docId}/check`, {
    method: "POST",
    cookie: viewerCookie,
  })
  addResult(
    "6.2 Viewer CANNOT run check (403)",
    viewerCheck.status === 403,
    `Status: ${viewerCheck.status}`
  )

  // 6.3: Non-existent document
  const notFound = await api("/documents/nonexistent/check", {
    method: "POST",
    cookie: adminCookie,
  })
  addResult(
    "6.3 Non-existent document returns 404",
    notFound.status === 404,
    `Status: ${notFound.status}`
  )
}

async function testPDFExport() {
  log("\n--- Test: PDF Export ---")

  // 7.1: Export PDF
  const res = await fetch(`${BASE}/documents/${docId}/results/pdf`, {
    headers: { Cookie: adminCookie },
  })

  addResult(
    "7.1 PDF export returns 200",
    res.status === 200,
    `Status: ${res.status}`
  )

  const contentType = res.headers.get("content-type")
  addResult(
    "7.2 Response is PDF",
    !!contentType?.includes("application/pdf"),
    `Content-Type: ${contentType}`
  )

  const contentDisposition = res.headers.get("content-disposition")
  addResult(
    "7.3 Has download filename",
    !!contentDisposition?.includes("compliance-report"),
    `Disposition: ${contentDisposition}`
  )

  const contentLength = parseInt(res.headers.get("content-length") || "0")
  addResult(
    "7.4 PDF has content (not empty)",
    contentLength > 1000,
    `Size: ${contentLength} bytes`
  )

  // 7.5: Viewer CAN export PDF
  const viewerPdf = await fetch(`${BASE}/documents/${docId}/results/pdf`, {
    headers: { Cookie: viewerCookie },
  })
  addResult(
    "7.5 Viewer CAN export PDF (200)",
    viewerPdf.status === 200,
    `Status: ${viewerPdf.status}`
  )
}

// ============================================
// MAIN RUNNER
// ============================================

async function runAllTests() {
  log("========================================")
  log("  PHASE B5 TEST: Compliance Engine")
  log("========================================")
  log("")
  log("NOTE: This test calls LLM APIs. Expect 30-90 seconds total.")
  log("")

  try {
    log("Logging in...")
    adminCookie = await loginAs("admin@demo.com", "password123")
    viewerCookie = await loginAs("viewer@demo.com", "password123")

    if (!adminCookie || !viewerCookie) {
      log("\nERROR: Failed to obtain session cookies.")
      process.exit(1)
    }
    log("Sessions obtained.")

    // Setup: upload doc and get checklist
    log("\nSetting up test data...")
    docId = await uploadDoc(adminCookie)
    log(`  Uploaded document: ${docId}`)

    const checklists = await api("/checklists?isTemplate=true&category=building", { cookie: adminCookie })
    checklistId = checklists.data?.checklists?.[0]?.id
    log(`  Using checklist: ${checklistId} (${checklists.data?.checklists?.[0]?.name})`)

    if (!docId || !checklistId) {
      log("\nERROR: Failed to create test data.")
      process.exit(1)
    }

    await testMatch()
    await testAutoMatch()
    await testMatchValidation()
    await testComplianceCheck()
    await testGetResults()
    await testCheckValidation()
    await testPDFExport()

    // Cleanup
    log("\nCleaning up test data...")
    await api(`/documents/${docId}`, { method: "DELETE", cookie: adminCookie })
    log("  Cleaned up.")
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
