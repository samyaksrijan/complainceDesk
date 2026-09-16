/**
 * Test Script: Phase B3 — Document Upload & Text Extraction
 *
 * Run: npx ts-node scripts/test-documents.ts
 *
 * Prerequisites:
 *   1. Docker PostgreSQL running
 *   2. npm run dev running on :3000
 *   3. Database seeded
 *   4. test-files/sample-audit.txt exists
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
let createdDocId = ""

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
      "Cookie": csrfCookie
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
  const sessionCookie = cookies
    .filter((c: string) => c.startsWith("next-auth.session-token"))
    .map((c: string) => c.split(";")[0])
    .join("; ")

  return sessionCookie
}

async function uploadDocument(
  cookie: string,
  filePath: string,
  name: string
): Promise<{ status: number; data: any }> {
  const fileBuffer = fs.readFileSync(filePath)
  const fileName = path.basename(filePath)
  const fileExt = path.extname(fileName).toLowerCase()

  // Determine MIME type
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  }
  const mimeType = mimeTypes[fileExt] || "application/octet-stream"

  // Create FormData manually for Node.js
  const boundary = "----FormBoundary" + Date.now()
  const fileName2 = path.basename(filePath)

  // Build multipart body manually
  let body = ""
  body += `--${boundary}\r\n`
  body += `Content-Disposition: form-data; name="name"\r\n\r\n`
  body += `${name}\r\n`
  body += `--${boundary}\r\n`
  body += `Content-Disposition: form-data; name="file"; filename="${fileName2}"\r\n`
  body += `Content-Type: ${mimeType}\r\n\r\n`

  const textPart = Buffer.from(body, "utf-8")
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8")
  const multipartBody = Buffer.concat([textPart, fileBuffer, endPart])

  const res = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Cookie: cookie,
    },
    body: multipartBody,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { status: res.status, data }
}

async function api(
  path: string,
  options: { method?: string; body?: any; cookie?: string } = {}
): Promise<{ status: number; data: any }> {
  const { method = "GET", body, cookie } = options
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (cookie) headers["Cookie"] = cookie
  const fetchOpts: RequestInit = { method, headers }
  if (body) fetchOpts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, fetchOpts)
  let data = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

// ============================================
// TEST GROUPS
// ============================================

async function testUpload() {
  log("\n--- Test: Upload Document ---")

  const testFile = path.join(process.cwd(), "test-files", "sample-audit.txt")

  // Check test file exists
  if (!fs.existsSync(testFile)) {
    addResult("0.0 Test file exists", false, `File not found: ${testFile}`)
    log("\n  Create test-files/sample-audit.txt first!")
    return
  }

  addResult("0.0 Test file exists", true, `Found: ${testFile}`)

  // 1.1: Upload as admin
  const res = await uploadDocument(adminCookie, testFile, "Building Audit Q1 2024")

  createdDocId = res.data?.id

  addResult(
    "1.1 Upload document returns 201",
    res.status === 201,
    `Status: ${res.status}`
  )

  addResult(
    "1.2 Document has correct name",
    res.data?.name === "Building Audit Q1 2024",
    `Name: ${res.data?.name}`
  )

  addResult(
    "1.3 Document has extracted text",
    typeof res.data?.extractedText === "string" && res.data.extractedText.length > 100,
    `Text length: ${res.data?.extractedText?.length || 0} chars`
  )

  addResult(
    "1.4 Document status is UNMATCHED",
    res.data?.status === "UNMATCHED",
    `Status: ${res.data?.status}`
  )

  addResult(
    "1.5 File type detected correctly",
    res.data?.fileType === "txt",
    `FileType: ${res.data?.fileType}`
  )

  addResult(
    "1.6 Uploaded by user info included",
    !!res.data?.uploadedBy?.name,
    `UploadedBy: ${res.data?.uploadedBy?.name}`
  )

  addResult(
    "1.7 Document ID is valid",
    typeof createdDocId === "string" && createdDocId.length > 10,
    `ID: ${createdDocId}`
  )

  // Verify extracted text contains expected content
  const extractedText = res.data?.extractedText || ""
  addResult(
    "1.8 Extracted text contains key content",
    extractedText.includes("Skyline Tower") && extractedText.includes("42 meters"),
    `Contains Skyline Tower: ${extractedText.includes("Skyline Tower")}, Contains 42 meters: ${extractedText.includes("42 meters")}`
  )
}

async function testUploadValidation() {
  log("\n--- Test: Upload Validation ---")

  // 2.1: Upload without name (should fail)
  const testFile = path.join(process.cwd(), "test-files", "sample-audit.txt")
  const fileBuffer = fs.readFileSync(testFile)
  const boundary = "----FormBoundary" + Date.now()
  const textPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.txt"\r\nContent-Type: text/plain\r\n\r\n`,
    "utf-8"
  )
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8")
  const noNameBody = Buffer.concat([textPart, fileBuffer, endPart])

  const noName = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Cookie: adminCookie,
    },
    body: noNameBody,
  })

  addResult(
    "2.1 Reject upload without name",
    noName.status === 400,
    `Status: ${noName.status}`
  )

  // 2.2: Upload with unsupported file type
  const fakeExe = Buffer.from("not a real exe")
  const boundary2 = "----FormBoundary" + Date.now()
  const textPart2 = Buffer.from(
    `--${boundary2}\r\n` +
    `Content-Disposition: form-data; name="name"\r\n\r\n` +
    `Bad File\r\n` +
    `--${boundary2}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="bad.exe"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`,
    "utf-8"
  )
  const endPart2 = Buffer.from(`\r\n--${boundary2}--\r\n`, "utf-8")
  const badTypeBody = Buffer.concat([textPart2, fakeExe, endPart2])

  const badType = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary2}`,
      Cookie: adminCookie,
    },
    body: badTypeBody,
  })

  addResult(
    "2.2 Reject unsupported file type (.exe)",
    badType.status === 415,
    `Status: ${badType.status}`
  )

  // 2.3: Upload without auth
  const boundary3 = "----FormBoundary" + Date.now()
  const textPart3 = Buffer.from(
    `--${boundary3}\r\nContent-Disposition: form-data; name="name"\r\n\r\nTest\r\n--${boundary3}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--${boundary3}--\r\n`,
    "utf-8"
  )

  const noAuth = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary3}`,
    },
    body: textPart3,
  })

  addResult(
    "2.3 Reject upload without authentication",
    noAuth.status === 401,
    `Status: ${noAuth.status}`
  )
}

async function testRBAC() {
  log("\n--- Test: Document RBAC ---")

  const testFile = path.join(process.cwd(), "test-files", "sample-audit.txt")

  // 3.1: Viewer cannot upload
  const viewerUpload = await uploadDocument(viewerCookie, testFile, "Viewer Upload")
  addResult(
    "3.1 Viewer CANNOT upload (403)",
    viewerUpload.status === 403,
    `Status: ${viewerUpload.status}`
  )

  // 3.2: Auditor can upload
  const auditorUpload = await uploadDocument(auditorCookie, testFile, "Auditor Upload")
  addResult(
    "3.2 Auditor CAN upload (201)",
    auditorUpload.status === 201,
    `Status: ${auditorUpload.status}`
  )

  // Store auditor doc ID for cleanup
  const auditorDocId = auditorUpload.data?.id

  // 3.3: Viewer CAN list documents
  const viewerList = await api("/documents", { cookie: viewerCookie })
  addResult(
    "3.3 Viewer CAN list documents (200)",
    viewerList.status === 200,
    `Status: ${viewerList.status}`
  )

  // 3.4: Viewer CAN view document detail
  const viewerDetail = await api(`/documents/${createdDocId}`, { cookie: viewerCookie })
  addResult(
    "3.4 Viewer CAN view document detail (200)",
    viewerDetail.status === 200,
    `Status: ${viewerDetail.status}`
  )

  // 3.5: Viewer CANNOT delete document
  const viewerDelete = await api(`/documents/${createdDocId}`, {
    method: "DELETE",
    cookie: viewerCookie,
  })
  addResult(
    "3.5 Viewer CANNOT delete (403)",
    viewerDelete.status === 403,
    `Status: ${viewerDelete.status}`
  )

  // 3.6: Auditor CANNOT delete document
  const auditorDelete = await api(`/documents/${createdDocId}`, {
    method: "DELETE",
    cookie: auditorCookie,
  })
  addResult(
    "3.6 Auditor CANNOT delete (403)",
    auditorDelete.status === 403,
    `Status: ${auditorDelete.status}`
  )

  // Clean up auditor's document
  if (auditorDocId) {
    await api(`/documents/${auditorDocId}`, {
      method: "DELETE",
      cookie: adminCookie,
    })
  }
}

async function testListDocuments() {
  log("\n--- Test: List Documents ---")

  // Upload a second document for listing tests
  const testFile = path.join(process.cwd(), "test-files", "sample-audit.txt")
  const upload2 = await uploadDocument(adminCookie, testFile, "Environmental Audit 2024")
  const doc2Id = upload2.data?.id

  // 4.1: List all documents
  const list = await api("/documents", { cookie: adminCookie })
  addResult(
    "4.1 List documents returns 200",
    list.status === 200,
    `Status: ${list.status}`
  )

  addResult(
    "4.2 List contains our uploaded documents",
    Array.isArray(list.data?.documents) && list.data.documents.length >= 2,
    `Found: ${list.data?.documents?.length || 0} documents`
  )

  addResult(
    "4.3 List includes pagination",
    !!list.data?.pagination && typeof list.data.pagination.total === "number",
    `Total: ${list.data?.pagination?.total}`
  )

  // 4.4: List does NOT include extractedText (too large)
  const firstDoc = list.data?.documents?.[0]
  addResult(
    "4.4 List excludes extractedText field",
    firstDoc?.extractedText === undefined,
    `extractedText in list: ${firstDoc?.extractedText !== undefined}`
  )

  // 4.5: List includes latestScore
  addResult(
    "4.5 List includes latestScore field",
    firstDoc?.hasOwnProperty("latestScore"),
    `latestScore: ${firstDoc?.latestScore}`
  )

  // 4.6: Search by name
  const search = await api("/documents?search=Environmental", { cookie: adminCookie })
  addResult(
    "4.6 Search by name works",
    search.status === 200 && search.data?.documents?.length >= 1,
    `Found: ${search.data?.documents?.length || 0} matching "Environmental"`
  )

  // 4.7: Filter by status
  const byStatus = await api("/documents?status=UNMATCHED", { cookie: adminCookie })
  addResult(
    "4.7 Filter by status works",
    byStatus.status === 200,
    `UNMATCHED docs: ${byStatus.data?.documents?.length || 0}`
  )

  // Clean up second document
  if (doc2Id) {
    await api(`/documents/${doc2Id}`, { method: "DELETE", cookie: adminCookie })
  }
}

async function testGetDocumentDetail() {
  log("\n--- Test: Get Document Detail ---")

  // 5.1: Get document detail
  const detail = await api(`/documents/${createdDocId}`, { cookie: adminCookie })
  addResult(
    "5.1 Get document detail returns 200",
    detail.status === 200,
    `Status: ${detail.status}`
  )

  addResult(
    "5.2 Detail includes extractedText",
    typeof detail.data?.extractedText === "string" && detail.data.extractedText.length > 100,
    `Text length: ${detail.data?.extractedText?.length || 0}`
  )

  addResult(
    "5.3 Detail includes uploadedBy info",
    !!detail.data?.uploadedBy?.name,
    `UploadedBy: ${detail.data?.uploadedBy?.name}`
  )

  addResult(
    "5.4 Detail includes status",
    !!detail.data?.status,
    `Status: ${detail.data?.status}`
  )

  addResult(
    "5.5 Detail includes fileType",
    detail.data?.fileType === "txt",
    `FileType: ${detail.data?.fileType}`
  )

  addResult(
    "5.6 Detail includes results array",
    Array.isArray(detail.data?.results),
    `Results: ${detail.data?.results?.length || 0}`
  )

  // 5.7: 404 for non-existent document
  const notFound = await api("/documents/nonexistent123", { cookie: adminCookie })
  addResult(
    "5.7 Returns 404 for non-existent document",
    notFound.status === 404,
    `Status: ${notFound.status}`
  )
}

async function testDeleteDocument() {
  log("\n--- Test: Delete Document ---")

  // 6.1: Delete as admin
  const res = await api(`/documents/${createdDocId}`, {
    method: "DELETE",
    cookie: adminCookie,
  })
  addResult(
    "6.1 Delete document returns 204",
    res.status === 204,
    `Status: ${res.status}`
  )

  // 6.2: Verify deleted
  const getDeleted = await api(`/documents/${createdDocId}`, { cookie: adminCookie })
  addResult(
    "6.2 Deleted document returns 404",
    getDeleted.status === 404,
    `Status: ${getDeleted.status}`
  )
}

// ============================================
// MAIN RUNNER
// ============================================

async function runAllTests() {
  log("========================================")
  log("  PHASE B3 TEST: Document Upload")
  log("========================================")
  log("")
  log("Prerequisites:")
  log("  1. docker compose up -d")
  log("  2. npm run dev")
  log("  3. npx prisma db seed")
  log("  4. test-files/sample-audit.txt exists")
  log("")

  try {
    log("Logging in as admin...")
    adminCookie = await loginAs("admin@demo.com", "password123")
    log("Logging in as auditor...")
    auditorCookie = await loginAs("auditor@demo.com", "password123")
    log("Logging in as viewer...")
    viewerCookie = await loginAs("viewer@demo.com", "password123")

    if (!adminCookie || !auditorCookie || !viewerCookie) {
      log("\nERROR: Failed to obtain session cookies.")
      process.exit(1)
    }
    log("All sessions obtained.\n")

    await testUpload()
    await testUploadValidation()
    await testRBAC()
    await testListDocuments()
    await testGetDocumentDetail()
    await testDeleteDocument()
  } catch (error) {
    log(`\nFATAL ERROR: ${error}`)
    console.error(error)
  }

  // Summary
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
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
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
