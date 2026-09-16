/**
 * Test Script: Phase B2 — Checklist CRUD
 *
 * Run: npx ts-node scripts/test-checklists.ts
 *
 * Prerequisites:
 *   1. Docker PostgreSQL running
 *   2. npm run dev running on :3000
 *   3. Database seeded (npx prisma db seed)
 */

const BASE = "http://localhost:3000/api"

interface TestResult {
  name: string
  passed: boolean
  detail: string
}

const results: TestResult[] = []
let adminCookie = ""
let auditorCookie = ""
let viewerCookie = ""
let createdChecklistId = ""
let clonedChecklistId = ""

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

async function api(
  path: string,
  options: {
    method?: string
    body?: any
    cookie?: string
  } = {}
): Promise<{ status: number; data: any }> {
  const { method = "GET", body, cookie } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (cookie) headers["Cookie"] = cookie

  const fetchOpts: RequestInit = { method, headers }
  if (body) fetchOpts.body = JSON.stringify(body)

  const res = await fetch(`${BASE}${path}`, fetchOpts)
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { status: res.status, data }
}

// ============================================
// TEST GROUPS
// ============================================

async function testListTemplates() {
  log("\n--- Test: List Templates ---")

  const res = await api("/checklists?isTemplate=true", { cookie: adminCookie })

  addResult(
    "1.1 List templates returns 200",
    res.status === 200,
    `Status: ${res.status}`
  )

  const templates = res.data?.checklists
  addResult(
    "1.2 Templates exist (from seed)",
    Array.isArray(templates) && templates.length >= 3,
    `Found: ${templates?.length || 0} templates`
  )

  const names = templates?.map((t: any) => t.name) || []
  addResult(
    "1.3 Expected template names present",
    names.includes("Building Safety Compliance") &&
      names.includes("Fire Safety Compliance") &&
      names.includes("Environmental Compliance"),
    `Names: ${names.join(", ")}`
  )

  // Check itemsCount is returned
  const firstTemplate = templates?.[0]
  addResult(
    "1.4 Template has itemsCount field",
    typeof firstTemplate?.itemsCount === "number" && firstTemplate.itemsCount > 0,
    `itemsCount: ${firstTemplate?.itemsCount}`
  )

  // Check pagination is returned
  addResult(
    "1.5 Response includes pagination",
    !!res.data?.pagination && typeof res.data.pagination.total === "number",
    `Pagination: page=${res.data?.pagination?.page}, total=${res.data?.pagination?.total}`
  )
}

async function testCreateChecklist() {
  log("\n--- Test: Create Checklist ---")

  // Test 2.1: Create a valid checklist with all field types
  const res = await api("/checklists", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Custom Building Audit",
      description: "Internal building audit checklist",
      category: "building",
      tags: ["internal", "safety", "custom"],
      isTemplate: false,
      items: [
        {
          fieldName: "Building Height",
          fieldType: "NUMBER",
          unit: "meters",
          condition: "LESS_THAN",
          thresholdValue: 50,
          regulationRef: "Section 4.1",
          sortOrder: 1,
        },
        {
          fieldName: "Fire Extinguisher Present",
          fieldType: "BOOLEAN",
          condition: "MUST_BE_PRESENT",
          thresholdValue: true,
          sortOrder: 2,
        },
        {
          fieldName: "Wall Material",
          fieldType: "TEXT",
          condition: "MUST_CONTAIN",
          thresholdValue: "fire-rated",
          sortOrder: 3,
        },
        {
          fieldName: "Emergency Exit Type",
          fieldType: "SELECT",
          condition: "EQUALS",
          thresholdValue: "staircase",
          options: ["staircase", "ramp", "elevator", "ladder"],
          sortOrder: 4,
        },
        {
          fieldName: "Load Capacity Range",
          fieldType: "NUMBER",
          unit: "kN/m²",
          condition: "RANGE",
          thresholdValue: [2.5, 10],
          sortOrder: 5,
        },
      ],
    },
  })

  createdChecklistId = res.data?.id

  addResult(
    "2.1 Create checklist returns 201",
    res.status === 201,
    `Status: ${res.status}`
  )

  addResult(
    "2.2 Created checklist has correct name",
    res.data?.name === "Custom Building Audit",
    `Name: ${res.data?.name}`
  )

  addResult(
    "2.3 Created checklist has 5 items",
    Array.isArray(res.data?.items) && res.data.items.length === 5,
    `Items: ${res.data?.items?.length}`
  )

  addResult(
    "2.4 Items sorted by sortOrder",
    res.data?.items?.[0]?.fieldName === "Building Height" &&
      res.data?.items?.[4]?.fieldName === "Load Capacity Range",
    `First: ${res.data?.items?.[0]?.fieldName}, Last: ${res.data?.items?.[4]?.fieldName}`
  )

  addResult(
    "2.5 Created by user info included",
    !!res.data?.createdBy?.name,
    `CreatedBy: ${res.data?.createdBy?.name}`
  )

  addResult(
    "2.6 ID is a valid cuid",
    typeof createdChecklistId === "string" && createdChecklistId.length > 10,
    `ID: ${createdChecklistId}`
  )
}

async function testValidation() {
  log("\n--- Test: Validation ---")

  // 3.1: Empty items array
  const noItems = await api("/checklists", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Empty Checklist",
      items: [],
    },
  })

  addResult(
    "3.1 Reject empty items array",
    noItems.status === 400,
    `Status: ${noItems.status}, Error: ${noItems.data?.error}`
  )

  // 3.2: Missing name
  const noName = await api("/checklists", {
    method: "POST",
    cookie: adminCookie,
    body: {
      items: [
        {
          fieldName: "Test",
          fieldType: "NUMBER",
          condition: "LESS_THAN",
          thresholdValue: 100,
          sortOrder: 1,
        },
      ],
    },
  })

  addResult(
    "3.2 Reject missing name",
    noName.status === 400,
    `Status: ${noName.status}`
  )

  // 3.3: NUMBER field with MUST_BE_PRESENT condition (invalid combo)
  const badCondition = await api("/checklists", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Bad Condition Checklist",
      items: [
        {
          fieldName: "Height",
          fieldType: "NUMBER",
          condition: "MUST_BE_PRESENT",
          thresholdValue: true,
          sortOrder: 1,
        },
      ],
    },
  })

  addResult(
    "3.3 Reject NUMBER + MUST_BE_PRESENT",
    badCondition.status === 400,
    `Status: ${badCondition.status}, Error: ${badCondition.data?.details?.condition?.[0]?.substring(0, 60) || badCondition.data?.error}`
  )

  // 3.4: BOOLEAN field with LESS_THAN condition (invalid combo)
  const badBool = await api("/checklists", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Bad Boolean Checklist",
      items: [
        {
          fieldName: "Is Safe",
          fieldType: "BOOLEAN",
          condition: "LESS_THAN",
          thresholdValue: 5,
          sortOrder: 1,
        },
      ],
    },
  })

  addResult(
    "3.4 Reject BOOLEAN + LESS_THAN",
    badBool.status === 400,
    `Status: ${badBool.status}`
  )

  // 3.5: NUMBER field with string thresholdValue
  const badThreshold = await api("/checklists", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Bad Threshold Checklist",
      items: [
        {
          fieldName: "Height",
          fieldType: "NUMBER",
          condition: "LESS_THAN",
          thresholdValue: "fifty", // should be number
          sortOrder: 1,
        },
      ],
    },
  })

  addResult(
    "3.5 Reject NUMBER with string threshold",
    badThreshold.status === 400,
    `Status: ${badThreshold.status}`
  )

  // 3.6: SELECT without options
  const noOptions = await api("/checklists", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "No Options Checklist",
      items: [
        {
          fieldName: "Exit Type",
          fieldType: "SELECT",
          condition: "EQUALS",
          thresholdValue: "staircase",
          sortOrder: 1,
          // no options array
        },
      ],
    },
  })

  addResult(
    "3.6 Reject SELECT without options",
    noOptions.status === 400,
    `Status: ${noOptions.status}`
  )

  // 3.7: RANGE with non-array thresholdValue
  const badRange = await api("/checklists", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Bad Range Checklist",
      items: [
        {
          fieldName: "Load",
          fieldType: "NUMBER",
          condition: "RANGE",
          thresholdValue: 5, // should be [min, max]
          sortOrder: 1,
        },
      ],
    },
  })

  addResult(
    "3.7 Reject RANGE with non-array threshold",
    badRange.status === 400,
    `Status: ${badRange.status}`
  )
}

async function testGetSingle() {
  log("\n--- Test: Get Single Checklist ---")

  // 4.1: Get the checklist we created
  const res = await api(`/checklists/${createdChecklistId}`, { cookie: adminCookie })

  addResult(
    "4.1 Get checklist by ID returns 200",
    res.status === 200,
    `Status: ${res.status}`
  )

  addResult(
    "4.2 Returned checklist has correct name",
    res.data?.name === "Custom Building Audit",
    `Name: ${res.data?.name}`
  )

  addResult(
    "4.3 Items are sorted by sortOrder",
    res.data?.items?.[0]?.sortOrder <= res.data?.items?.[1]?.sortOrder,
    `Sort orders: ${res.data?.items?.map((i: any) => i.sortOrder).join(", ")}`
  )

  addResult(
    "4.4 All 5 items present",
    res.data?.items?.length === 5,
    `Items: ${res.data?.items?.length}`
  )

  // 4.5: 404 for non-existent ID
  const notFound = await api("/checklists/nonexistent123", { cookie: adminCookie })

  addResult(
    "4.5 Returns 404 for non-existent ID",
    notFound.status === 404,
    `Status: ${notFound.status}`
  )
}

async function testUpdateChecklist() {
  log("\n--- Test: Update Checklist ---")

  // 5.1: Update metadata only
  const metaUpdate = await api(`/checklists/${createdChecklistId}`, {
    method: "PUT",
    cookie: adminCookie,
    body: {
      name: "Custom Building Audit v2",
      description: "Updated description",
    },
  })

  addResult(
    "5.1 Update metadata returns 200",
    metaUpdate.status === 200,
    `Status: ${metaUpdate.status}`
  )

  addResult(
    "5.2 Name updated correctly",
    metaUpdate.data?.name === "Custom Building Audit v2",
    `Name: ${metaUpdate.data?.name}`
  )

  addResult(
    "5.3 Items unchanged (not provided in update)",
    metaUpdate.data?.items?.length === 5,
    `Items: ${metaUpdate.data?.items?.length}`
  )

  // 5.2: Update items (add a new one, total 6)
  const itemsUpdate = await api(`/checklists/${createdChecklistId}`, {
    method: "PUT",
    cookie: adminCookie,
    body: {
      items: [
        {
          fieldName: "Building Height",
          fieldType: "NUMBER",
          unit: "meters",
          condition: "LESS_THAN",
          thresholdValue: 50,
          regulationRef: "Section 4.1",
          sortOrder: 1,
        },
        {
          fieldName: "Fire Extinguisher Present",
          fieldType: "BOOLEAN",
          condition: "MUST_BE_PRESENT",
          thresholdValue: true,
          sortOrder: 2,
        },
        {
          fieldName: "Wall Material",
          fieldType: "TEXT",
          condition: "MUST_CONTAIN",
          thresholdValue: "fire-rated",
          sortOrder: 3,
        },
        {
          fieldName: "Emergency Exit Type",
          fieldType: "SELECT",
          condition: "EQUALS",
          thresholdValue: "staircase",
          options: ["staircase", "ramp", "elevator", "ladder"],
          sortOrder: 4,
        },
        {
          fieldName: "Load Capacity Range",
          fieldType: "NUMBER",
          unit: "kN/m²",
          condition: "RANGE",
          thresholdValue: [2.5, 10],
          sortOrder: 5,
        },
        {
          fieldName: "Parking Spaces",
          fieldType: "NUMBER",
          unit: "spaces",
          condition: "GREATER_THAN",
          thresholdValue: 10,
          sortOrder: 6,
        },
      ],
    },
  })

  addResult(
    "5.4 Update items returns 200",
    itemsUpdate.status === 200,
    `Status: ${itemsUpdate.status}`
  )

  addResult(
    "5.5 Now has 6 items (new item added)",
    itemsUpdate.data?.items?.length === 6,
    `Items: ${itemsUpdate.data?.items?.length}`
  )

  addResult(
    "5.6 New item present (Parking Spaces)",
    itemsUpdate.data?.items?.some((i: any) => i.fieldName === "Parking Spaces"),
    `Last item: ${itemsUpdate.data?.items?.[5]?.fieldName}`
  )

  // Verify metadata was preserved (name from 5.1)
  addResult(
    "5.7 Previous metadata update preserved",
    itemsUpdate.data?.name === "Custom Building Audit v2",
    `Name: ${itemsUpdate.data?.name}`
  )
}

async function testCloneChecklist() {
  log("\n--- Test: Clone Checklist ---")

  // Get a template ID first
  const templates = await api("/checklists?isTemplate=true", { cookie: adminCookie })
  const templateId = templates.data?.checklists?.[0]?.id

  // 6.1: Clone a template
  const res = await api(`/checklists/${templateId}/clone`, {
    method: "POST",
    cookie: adminCookie,
  })

  clonedChecklistId = res.data?.id

  addResult(
    "6.1 Clone template returns 201",
    res.status === 201,
    `Status: ${res.status}`
  )

  addResult(
    "6.2 Cloned name has (Copy) suffix",
    res.data?.name?.includes("(Copy)"),
    `Name: ${res.data?.name}`
  )

  addResult(
    "6.3 Cloned isTemplate is false",
    res.data?.isTemplate === false,
    `isTemplate: ${res.data?.isTemplate}`
  )

  addResult(
    "6.4 Cloned has same items count as source",
    res.data?.items?.length === templates.data?.checklists?.[0]?.itemsCount,
    `Cloned: ${res.data?.items?.length}, Source: ${templates.data?.checklists?.[0]?.itemsCount}`
  )

  addResult(
    "6.5 Cloned checklist has different ID than source",
    res.data?.id !== templateId,
    `Source: ${templateId}, Clone: ${res.data?.id}`
  )

  // 6.2: Auditor can also clone
  const auditorClone = await api(`/checklists/${templateId}/clone`, {
    method: "POST",
    cookie: auditorCookie,
  })

  addResult(
    "6.6 Auditor can clone templates",
    auditorClone.status === 201,
    `Status: ${auditorClone.status}`
  )
}

async function testRBAC() {
  log("\n--- Test: RBAC ---")

  // 7.1: Viewer cannot create checklist
  const viewerCreate = await api("/checklists", {
    method: "POST",
    cookie: viewerCookie,
    body: {
      name: "Viewer Checklist",
      items: [
        {
          fieldName: "Test",
          fieldType: "NUMBER",
          condition: "LESS_THAN",
          thresholdValue: 100,
          sortOrder: 1,
        },
      ],
    },
  })

  addResult(
    "7.1 Viewer CANNOT create checklist (403)",
    viewerCreate.status === 403,
    `Status: ${viewerCreate.status}`
  )

  // 7.2: Viewer cannot update checklist
  const viewerUpdate = await api(`/checklists/${createdChecklistId}`, {
    method: "PUT",
    cookie: viewerCookie,
    body: { name: "Hacked Name" },
  })

  addResult(
    "7.2 Viewer CANNOT update checklist (403)",
    viewerUpdate.status === 403,
    `Status: ${viewerUpdate.status}`
  )

  // 7.3: Viewer cannot delete checklist
  const viewerDelete = await api(`/checklists/${createdChecklistId}`, {
    method: "DELETE",
    cookie: viewerCookie,
  })

  addResult(
    "7.3 Viewer CANNOT delete checklist (403)",
    viewerDelete.status === 403,
    `Status: ${viewerDelete.status}`
  )

  // 7.4: Viewer CAN list and view checklists
  const viewerList = await api("/checklists", { cookie: viewerCookie })

  addResult(
    "7.4 Viewer CAN list checklists (200)",
    viewerList.status === 200,
    `Status: ${viewerList.status}`
  )

  const viewerGet = await api(`/checklists/${createdChecklistId}`, { cookie: viewerCookie })

  addResult(
    "7.5 Viewer CAN view single checklist (200)",
    viewerGet.status === 200,
    `Status: ${viewerGet.status}`
  )

  // 7.5: Auditor can create
  const auditorCreate = await api("/checklists", {
    method: "POST",
    cookie: auditorCookie,
    body: {
      name: "Auditor Checklist",
      items: [
        {
          fieldName: "Test Field",
          fieldType: "TEXT",
          condition: "MUST_CONTAIN",
          thresholdValue: "required",
          sortOrder: 1,
        },
      ],
    },
  })

  addResult(
    "7.6 Auditor CAN create checklist (201)",
    auditorCreate.status === 201,
    `Status: ${auditorCreate.status}`
  )

  // 7.7: Auditor CANNOT delete
  const auditorDelete = await api(`/checklists/${auditorCreate.data?.id}`, {
    method: "DELETE",
    cookie: auditorCookie,
  })

  addResult(
    "7.7 Auditor CANNOT delete checklist (403)",
    auditorDelete.status === 403,
    `Status: ${auditorDelete.status}`
  )

  // Clean up: delete the auditor's checklist as admin
  await api(`/checklists/${auditorCreate.data?.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  })
}

async function testDeleteChecklist() {
  log("\n--- Test: Delete Checklist ---")

  // 8.1: Delete the custom checklist we created
  const res = await api(`/checklists/${createdChecklistId}`, {
    method: "DELETE",
    cookie: adminCookie,
  })

  addResult(
    "8.1 Delete checklist returns 204",
    res.status === 204,
    `Status: ${res.status}`
  )

  // 8.2: Verify it is gone
  const getDeleted = await api(`/checklists/${createdChecklistId}`, { cookie: adminCookie })

  addResult(
    "8.2 Deleted checklist returns 404",
    getDeleted.status === 404,
    `Status: ${getDeleted.status}`
  )

  // 8.3: Delete cloned checklists
  if (clonedChecklistId) {
    const delClone = await api(`/checklists/${clonedChecklistId}`, {
      method: "DELETE",
      cookie: adminCookie,
    })
    addResult(
      "8.3 Delete cloned checklist returns 204",
      delClone.status === 204,
      `Status: ${delClone.status}`
    )
  }
}

async function testListWithFilters() {
  log("\n--- Test: List with Filters ---")

  // 9.1: Filter by category
  const byCategory = await api("/checklists?category=building", { cookie: adminCookie })

  addResult(
    "9.1 Filter by category works",
    byCategory.status === 200 && byCategory.data?.checklists?.length > 0,
    `Found: ${byCategory.data?.checklists?.length} building checklists`
  )

  // 9.2: Search by name
  const bySearch = await api("/checklists?search=Fire", { cookie: adminCookie })

  addResult(
    "9.2 Search by name works",
    bySearch.status === 200 && bySearch.data?.checklists?.length > 0,
    `Found: ${bySearch.data?.checklists?.length} matching "Fire"`
  )

  // 9.3: Filter by tags
  const byTags = await api("/checklists?tags=safety", { cookie: adminCookie })

  addResult(
    "9.3 Filter by tags works",
    byTags.status === 200,
    `Found: ${byTags.data?.checklists?.length} with tag "safety"`
  )

  // 9.4: Pagination
  const page1 = await api("/checklists?page=1&limit=2", { cookie: adminCookie })

  addResult(
    "9.4 Pagination works (limit 2)",
    page1.status === 200 && page1.data?.checklists?.length <= 2,
    `Returned: ${page1.data?.checklists?.length}, Total: ${page1.data?.pagination?.total}`
  )

  addResult(
    "9.5 Pagination metadata correct",
    page1.data?.pagination?.totalPages >= 1 &&
      page1.data?.pagination?.limit === 2,
    `TotalPages: ${page1.data?.pagination?.totalPages}, Limit: ${page1.data?.pagination?.limit}`
  )
}

// ============================================
// MAIN RUNNER
// ============================================

async function runAllTests() {
  log("========================================")
  log("  PHASE B2 TEST: Checklist CRUD")
  log("========================================")
  log("")
  log("Prerequisites:")
  log("  1. docker compose up -d")
  log("  2. npm run dev")
  log("  3. npx prisma db seed")
  log("")

  try {
    // Login as all three roles
    log("Logging in as admin...")
    adminCookie = await loginAs("admin@demo.com", "password123")

    log("Logging in as auditor...")
    auditorCookie = await loginAs("auditor@demo.com", "password123")

    log("Logging in as viewer...")
    viewerCookie = await loginAs("viewer@demo.com", "password123")

    log(`\nSessions obtained:`)
    log(`  Admin cookie length: ${adminCookie.length}`)
    log(`  Auditor cookie length: ${auditorCookie.length}`)
    log(`  Viewer cookie length: ${viewerCookie.length}`)

    if (!adminCookie || !auditorCookie || !viewerCookie) {
      log("\nERROR: Failed to obtain session cookies. Is the dev server running?")
      process.exit(1)
    }

    await testListTemplates()
    await testCreateChecklist()
    await testValidation()
    await testGetSingle()
    await testUpdateChecklist()
    await testCloneChecklist()
    await testRBAC()
    await testListWithFilters()
    await testDeleteChecklist()
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
