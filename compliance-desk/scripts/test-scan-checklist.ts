/**
 * Test Script: Phase B4a — Checklist Scanning via LLM
 *
 * Run: npx ts-node scripts/test-scan-checklist.ts
 *
 * Prerequisites:
 *   1. Docker PostgreSQL running
 *   2. npm run dev running on :3000
 *   3. GROQ_API_KEY set in .env
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
let auditorCookie = ""
let viewerCookie = ""

function log(msg: string) {
  console.log(msg)
}

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
      email,
      password,
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

const SAMPLE_COMPLIANCE_TEXT = `
BUILDING SAFETY COMPLIANCE REQUIREMENTS
Document Reference: BSCR-2024-001
Effective Date: January 1, 2024

Section 4: Structural Requirements

4.1 Building Height: The total building height shall not 
exceed 50 meters for residential zones and 100 meters 
for commercial zones.

4.2 Fire Safety: Fire extinguishers must be present on 
every floor. Maximum travel distance to nearest exit 
shall not exceed 30 meters.

4.3 Occupancy: Maximum occupancy per floor shall not 
exceed 200 persons for standard buildings.

4.4 Structural Load: Dead load capacity must meet a 
minimum of 5 kN/m². Live load must be at least 2.5 kN/m².

4.5 Ventilation: All habitable rooms must have adequate 
natural or mechanical ventilation. Minimum window area 
shall be 10% of floor area.

4.6 Emergency Exit: Every building above 15 meters must 
have at least 2 emergency staircases.

4.7 Wall Material: Load bearing walls must be constructed 
with fire-rated material. Minimum fire resistance rating 
shall be 2 hours.
`

async function testScanWithText() {
  log("\n--- Test: Scan Checklist from Text ---")

  // 1.1: Scan compliance text
  log("  (calling LLM — may take 5-15 seconds...)")
  const res = await fetch(`${BASE}/scan/checklist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ text: SAMPLE_COMPLIANCE_TEXT }),
  })

  const data = await res.json()

  addResult(
    "1.1 Scan returns 200",
    res.status === 200,
    `Status: ${res.status}`
  )

  addResult(
    "1.2 Response has items array",
    Array.isArray(data.items) && data.items.length > 0,
    `Items found: ${data.items?.length || 0}`
  )

  addResult(
    "1.3 Response has meta info",
    !!data.meta?.provider && !!data.meta?.model,
    `Provider: ${data.meta?.provider}, Model: ${data.meta?.model}`
  )

  // Check each item has required fields
  const items = data.items || []
  let allItemsValid = true
  let invalidReasons: string[] = []

  items.forEach((item: any, i: number) => {
    if (!item.field_name) { allItemsValid = false; invalidReasons.push(`Item ${i}: missing field_name`) }
    if (!item.field_type) { allItemsValid = false; invalidReasons.push(`Item ${i}: missing field_type`) }
    if (!item.condition) { allItemsValid = false; invalidReasons.push(`Item ${i}: missing condition`) }
    if (item.threshold_value === undefined || item.threshold_value === null) {
      allItemsValid = false
      invalidReasons.push(`Item ${i}: missing threshold_value`)
    }
    if (item.confidence === undefined || item.confidence === null) {
      allItemsValid = false
      invalidReasons.push(`Item ${i}: missing confidence`)
    }
  })

  addResult(
    "1.4 All items have required fields (field_name, field_type, condition, threshold_value, confidence)",
    allItemsValid,
    allItemsValid ? "All items valid" : invalidReasons.join("; ")
  )

  // Check field type distribution
  const types = items.reduce((acc: any, item: any) => {
    const t = (item.field_type || "").toLowerCase()
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  addResult(
    "1.5 Has at least one NUMBER field",
    (types.number || 0) >= 1,
    `Types: ${JSON.stringify(types)}`
  )

  addResult(
    "1.6 Has at least one BOOLEAN field",
    (types.boolean || 0) >= 1,
    `Types: ${JSON.stringify(types)}`
  )

  // Check that field_type values are valid
  const validTypes = ["number", "boolean", "text", "select"]
  const invalidTypes = items.filter(
    (item: any) => !validTypes.includes((item.field_type || "").toLowerCase())
  )

  addResult(
    "1.7 All field_type values are valid",
    invalidTypes.length === 0,
    invalidTypes.length === 0 ? "All valid" : `Invalid: ${invalidTypes.map((i: any) => i.field_type).join(", ")}`
  )

  // Check that condition values are valid
  const validConditions = [
    "less_than", "greater_than", "equals", "range",
    "must_be_present", "must_contain", "is_true",
  ]
  const invalidConditions = items.filter(
    (item: any) => !validConditions.includes((item.condition || "").toLowerCase())
  )

  addResult(
    "1.8 All condition values are valid",
    invalidConditions.length === 0,
    invalidConditions.length === 0 ? "All valid" : `Invalid: ${invalidConditions.map((i: any) => i.condition).join(", ")}`
  )

  // Check confidence scores are reasonable
  const lowConfidence = items.filter((item: any) => item.confidence < 0.5)
  const highConfidence = items.filter((item: any) => item.confidence >= 0.8)

  addResult(
    "1.9 Most items have confidence >= 0.5",
    lowConfidence.length <= items.length * 0.3,
    `High (>=0.8): ${highConfidence.length}, Low (<0.5): ${lowConfidence.length}, Total: ${items.length}`
  )

  // Check source_text is present
  const withSourceText = items.filter((item: any) => item.source_text && item.source_text.length > 10)

  addResult(
    "1.10 Most items have source_text",
    withSourceText.length >= items.length * 0.5,
    `With source_text: ${withSourceText.length}/${items.length}`
  )

  // Print extracted items for visual inspection
  log("\n  Extracted items:")
  items.forEach((item: any, i: number) => {
    log(`    ${i + 1}. ${item.field_name}`)
    log(`       Type: ${item.field_type} | Condition: ${item.condition} | Threshold: ${JSON.stringify(item.threshold_value)}`)
    log(`       Unit: ${item.unit || "none"} | Confidence: ${item.confidence} | Ref: ${item.regulation_ref || "none"}`)
    log(`       Source: "${(item.source_text || "").substring(0, 80)}..."`)
  })
}

async function testScanWithFile() {
  log("\n--- Test: Scan Checklist from File ---")

  const testFile = path.join(process.cwd(), "test-files", "sample-compliance.txt")
  if (!fs.existsSync(testFile)) {
    addResult("2.0 Test file exists", false, "sample-compliance.txt not found")
    return
  }

  const fileBuffer = fs.readFileSync(testFile)
  const boundary = "----FormBoundary" + Date.now()
  const textPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample-compliance.txt"\r\nContent-Type: text/plain\r\n\r\n`,
    "utf-8"
  )
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8")
  const body = Buffer.concat([textPart, fileBuffer, endPart])

  log("  (calling LLM via file upload — may take 5-15 seconds...)")
  const res = await fetch(`${BASE}/scan/checklist`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Cookie: adminCookie,
    },
    body,
  })

  const data = await res.json()

  addResult(
    "2.1 Scan file returns 200",
    res.status === 200,
    `Status: ${res.status}`
  )

  addResult(
    "2.2 File scan returns items",
    Array.isArray(data.items) && data.items.length > 0,
    `Items: ${data.items?.length || 0}`
  )
}

async function testScanValidation() {
  log("\n--- Test: Scan Validation ---")

  // 3.1: Empty text
  const empty = await fetch(`${BASE}/scan/checklist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ text: "" }),
  })

  addResult(
    "3.1 Reject empty text",
    empty.status === 400,
    `Status: ${empty.status}`
  )

  // 3.2: Too short text
  const short = await fetch(`${BASE}/scan/checklist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ text: "too short" }),
  })

  addResult(
    "3.2 Reject too-short text",
    short.status === 400,
    `Status: ${short.status}`
  )

  // 3.3: No auth
  const noAuth = await fetch(`${BASE}/scan/checklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: SAMPLE_COMPLIANCE_TEXT }),
  })

  addResult(
    "3.3 Reject unauthenticated request",
    noAuth.status === 401,
    `Status: ${noAuth.status}`
  )

  // 3.4: Viewer cannot scan
  const viewerScan = await fetch(`${BASE}/scan/checklist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: viewerCookie,
    },
    body: JSON.stringify({ text: SAMPLE_COMPLIANCE_TEXT }),
  })

  addResult(
    "3.4 Viewer CANNOT scan (403)",
    viewerScan.status === 403,
    `Status: ${viewerScan.status}`
  )

  // 3.5: Auditor CAN scan
  log("  (testing auditor access — calling LLM again...)")
  const auditorScan = await fetch(`${BASE}/scan/checklist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: auditorCookie,
    },
    body: JSON.stringify({ text: "Building Safety Requirements\n\n4.1 Maximum height: 50 meters\n4.2 Fire extinguishers required on all floors" }),
  })

  addResult(
    "3.5 Auditor CAN scan (200)",
    auditorScan.status === 200,
    `Status: ${auditorScan.status}`
  )
}

async function runAllTests() {
  log("========================================")
  log("  PHASE B4a TEST: Checklist Scanning")
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
    auditorCookie = await loginAs("auditor@demo.com", "password123")
    viewerCookie = await loginAs("viewer@demo.com", "password123")

    if (!adminCookie || !auditorCookie || !viewerCookie) {
      log("\nERROR: Failed to obtain session cookies.")
      process.exit(1)
    }
    log("Sessions obtained.\n")

    await testScanWithText()
    await testScanWithFile()
    await testScanValidation()
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
