/**
 * Test Script: Phase B6a — Dashboard Stats & Activity
 *
 * Run: npx ts-node scripts/test-dashboard.ts
 *
 * Prerequisites:
 *   1. Docker PostgreSQL running
 *   2. npm run dev running on :3000
 *   3. Database seeded
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

async function createTestData(cookie: string) {
  // Upload a document and run a check to generate activity logs and stats
  const testFile = path.join(process.cwd(), "test-files", "sample-audit.txt")
  const fileBuffer = fs.readFileSync(testFile)
  const boundary = "----FormBoundary" + Date.now()
  const textPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nDashboard Test Audit\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample-audit.txt"\r\nContent-Type: text/plain\r\n\r\n`,
    "utf-8"
  )
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8")
  const body = Buffer.concat([textPart, fileBuffer, endPart])

  const uploadRes = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, Cookie: cookie },
    body,
  })
  const doc = await uploadRes.json()
  return doc.id
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

async function testDashboardStats() {
  log("\n--- Test: Dashboard Stats ---")

  // Create some test data first
  log("  Creating test data...")
  const docId = await createTestData(adminCookie)
  log(`  Created document: ${docId}`)

  // 1.1: Admin can get stats
  const stats = await api("/dashboard/stats", { cookie: adminCookie })

  addResult(
    "1.1 Dashboard stats returns 200",
    stats.status === 200,
    `Status: ${stats.status}`
  )

  addResult(
    "1.2 Has totalDocuments",
    typeof stats.data?.totalDocuments === "number" && stats.data.totalDocuments >= 1,
    `Total: ${stats.data?.totalDocuments}`
  )

  addResult(
    "1.3 Has complianceRate",
    typeof stats.data?.complianceRate === "number",
    `Rate: ${stats.data?.complianceRate}%`
  )

  addResult(
    "1.4 Has activeChecklists",
    typeof stats.data?.activeChecklists === "number",
    `Checklists: ${stats.data?.activeChecklists}`
  )

  addResult(
    "1.5 Has pendingReviews",
    typeof stats.data?.pendingReviews === "number",
    `Pending: ${stats.data?.pendingReviews}`
  )

  addResult(
    "1.6 Has breakdown object",
    !!stats.data?.breakdown &&
      typeof stats.data.breakdown.compliant === "number" &&
      typeof stats.data.breakdown.nonCompliant === "number" &&
      typeof stats.data.breakdown.pending === "number",
    `Breakdown: compliant=${stats.data?.breakdown?.compliant}, nonCompliant=${stats.data?.breakdown?.nonCompliant}, pending=${stats.data?.breakdown?.pending}`
  )

  addResult(
    "1.7 Has byCategory array",
    Array.isArray(stats.data?.byCategory),
    `Categories: ${stats.data?.byCategory?.length || 0}`
  )

  addResult(
    "1.8 Has recentDocuments array",
    Array.isArray(stats.data?.recentDocuments) && stats.data.recentDocuments.length >= 1,
    `Recent: ${stats.data?.recentDocuments?.length || 0}`
  )

  // Clean up
  await api(`/documents/${docId}`, { method: "DELETE", cookie: adminCookie })
}

async function testDashboardRBAC() {
  log("\n--- Test: Dashboard RBAC ---")

  // 2.1: All roles can access stats
  for (const [name, cookie] of [["admin", adminCookie], ["auditor", auditorCookie], ["viewer", viewerCookie]]) {
    const res = await api("/dashboard/stats", { cookie })
    addResult(
      `2.${name === "admin" ? 1 : name === "auditor" ? 2 : 3} ${name} CAN access stats (200)`,
      res.status === 200,
      `Status: ${res.status}`
    )
  }

  // 2.4: Unauthenticated cannot access
  const noAuth = await fetch(`${BASE}/dashboard/stats`)
  addResult(
    "2.4 Unauthenticated CANNOT access (401)",
    noAuth.status === 401,
    `Status: ${noAuth.status}`
  )
}

async function testActivityFeed() {
  log("\n--- Test: Activity Feed ---")

  // 3.1: Get activity feed
  const activity = await api("/dashboard/activity", { cookie: adminCookie })

  addResult(
    "3.1 Activity feed returns 200",
    activity.status === 200,
    `Status: ${activity.status}`
  )

  addResult(
    "3.2 Has activities array",
    Array.isArray(activity.data?.activities),
    `Activities: ${activity.data?.activities?.length || 0}`
  )

  // Check activity has required fields
  const activities = activity.data?.activities || []
  if (activities.length > 0) {
    const first = activities[0]

    addResult(
      "3.3 Activities have action field",
      !!first.action,
      `Action: ${first.action}`
    )

    addResult(
      "3.4 Activities have user info",
      !!first.user?.name,
      `User: ${first.user?.name}`
    )

    addResult(
      "3.5 Activities have createdAt",
      !!first.createdAt,
      `Created: ${first.createdAt}`
    )

    addResult(
      "3.6 Activities have resourceType",
      !!first.resourceType,
      `Type: ${first.resourceType}`
    )
  }

  // 3.7: Limit parameter works
  const limited = await api("/dashboard/activity?limit=2", { cookie: adminCookie })
  addResult(
    "3.7 Limit parameter works",
    limited.status === 200 && (limited.data?.activities?.length || 0) <= 2,
    `Returned: ${limited.data?.activities?.length || 0}`
  )

  // 3.8: Viewer can access activity
  const viewerActivity = await api("/dashboard/activity", { cookie: viewerCookie })
  addResult(
    "3.8 Viewer CAN access activity (200)",
    viewerActivity.status === 200,
    `Status: ${viewerActivity.status}`
  )
}

// ============================================
// MAIN RUNNER
// ============================================

async function runAllTests() {
  log("========================================")
  log("  PHASE B6a TEST: Dashboard & Activity")
  log("========================================")

  try {
    log("\nLogging in...")
    adminCookie = await loginAs("admin@demo.com", "password123")
    auditorCookie = await loginAs("auditor@demo.com", "password123")
    viewerCookie = await loginAs("viewer@demo.com", "password123")

    if (!adminCookie || !auditorCookie || !viewerCookie) {
      log("\nERROR: Failed to obtain session cookies.")
      process.exit(1)
    }
    log("Sessions obtained.")

    await testDashboardStats()
    await testDashboardRBAC()
    await testActivityFeed()
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
