import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Clean existing data
  await prisma.activityLog.deleteMany()
  await prisma.complianceResultItem.deleteMany()
  await prisma.complianceResult.deleteMany()
  await prisma.checklistItem.deleteMany()
  await prisma.checklist.deleteMany()
  await prisma.document.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()

  console.log("  Cleaned existing data")

  // Create demo organization
  const org = await prisma.organization.create({
    data: { name: "Demo Corp" },
  })
  console.log(`  Created org: ${org.name} (${org.id})`)

  // Hash password once for all users
  const passwordHash = await bcrypt.hash("password123", 10)

  // Create users
  const admin = await prisma.user.create({
    data: {
      email: "admin@demo.com",
      passwordHash,
      name: "Admin User",
      role: "ADMIN",
      orgId: org.id,
    },
  })

  const auditor = await prisma.user.create({
    data: {
      email: "auditor@demo.com",
      passwordHash,
      name: "Auditor User",
      role: "AUDITOR",
      orgId: org.id,
    },
  })

  const viewer = await prisma.user.create({
    data: {
      email: "viewer@demo.com",
      passwordHash,
      name: "Viewer User",
      role: "VIEWER",
      orgId: org.id,
    },
  })

  console.log(`  Created users:`)
  console.log(`    ${admin.email} (ADMIN)`)
  console.log(`    ${auditor.email} (AUDITOR)`)
  console.log(`    ${viewer.email} (VIEWER)`)

  // ---- Pre-built checklist templates ----
  // TODO: In production, templates should belong to a system/global org
  // or use a global template pool. For now, they belong to the demo org.

  // Template 1: Building Safety
  const buildingSafety = await prisma.checklist.create({
    data: {
      name: "Building Safety Compliance",
      description: "Standard building structural and safety requirements",
      category: "building",
      tags: ["safety", "structural", "building"],
      sourceType: "TEMPLATE",
      isTemplate: true,
      orgId: org.id,
      createdById: admin.id,
      items: {
        create: [
          {
            fieldName: "Building Height (Residential)",
            fieldType: "NUMBER",
            unit: "meters",
            condition: "LESS_THAN",
            thresholdValue: 50,
            regulationRef: "Section 4.1",
            sortOrder: 1,
          },
          {
            fieldName: "Building Height (Commercial)",
            fieldType: "NUMBER",
            unit: "meters",
            condition: "LESS_THAN",
            thresholdValue: 100,
            regulationRef: "Section 4.1",
            sortOrder: 2,
          },
          {
            fieldName: "Dead Load Capacity",
            fieldType: "NUMBER",
            unit: "kN/m²",
            condition: "GREATER_THAN",
            thresholdValue: 5,
            regulationRef: "Section 4.4",
            sortOrder: 3,
          },
          {
            fieldName: "Live Load Capacity",
            fieldType: "NUMBER",
            unit: "kN/m²",
            condition: "GREATER_THAN",
            thresholdValue: 2.5,
            regulationRef: "Section 4.4",
            sortOrder: 4,
          },
          {
            fieldName: "Emergency Staircases Required",
            fieldType: "BOOLEAN",
            condition: "MUST_BE_PRESENT",
            thresholdValue: true,
            regulationRef: "Section 4.6",
            sortOrder: 5,
          },
          {
            fieldName: "Fire Resistance Rating",
            fieldType: "NUMBER",
            unit: "hours",
            condition: "GREATER_THAN",
            thresholdValue: 2,
            regulationRef: "Section 4.7",
            sortOrder: 6,
          },
          {
            fieldName: "Wall Material",
            fieldType: "TEXT",
            condition: "MUST_CONTAIN",
            thresholdValue: "fire-rated",
            regulationRef: "Section 4.7",
            sortOrder: 7,
          },
          {
            fieldName: "Maximum Occupancy Per Floor",
            fieldType: "NUMBER",
            unit: "persons",
            condition: "LESS_THAN",
            thresholdValue: 200,
            regulationRef: "Section 4.3",
            sortOrder: 8,
          },
        ],
      },
    },
    include: { items: true },
  })
  console.log(`  Created template: ${buildingSafety.name} (${buildingSafety.items.length} items)`)

  // Template 2: Fire Safety
  const fireSafety = await prisma.checklist.create({
    data: {
      name: "Fire Safety Compliance",
      description: "Fire prevention, detection, and safety requirements",
      category: "fire",
      tags: ["safety", "fire", "emergency"],
      sourceType: "TEMPLATE",
      isTemplate: true,
      orgId: org.id,
      createdById: admin.id,
      items: {
        create: [
          {
            fieldName: "Fire Extinguishers Present",
            fieldType: "BOOLEAN",
            condition: "MUST_BE_PRESENT",
            thresholdValue: true,
            regulationRef: "Section 5.1",
            sortOrder: 1,
          },
          {
            fieldName: "Distance to Nearest Exit",
            fieldType: "NUMBER",
            unit: "meters",
            condition: "LESS_THAN",
            thresholdValue: 30,
            regulationRef: "Section 5.2",
            sortOrder: 2,
          },
          {
            fieldName: "Fire Alarm System",
            fieldType: "BOOLEAN",
            condition: "MUST_BE_PRESENT",
            thresholdValue: true,
            regulationRef: "Section 5.3",
            sortOrder: 3,
          },
          {
            fieldName: "Sprinkler System",
            fieldType: "BOOLEAN",
            condition: "MUST_BE_PRESENT",
            thresholdValue: true,
            regulationRef: "Section 5.4",
            sortOrder: 4,
          },
          {
            fieldName: "Emergency Lighting",
            fieldType: "BOOLEAN",
            condition: "MUST_BE_PRESENT",
            thresholdValue: true,
            regulationRef: "Section 5.5",
            sortOrder: 5,
          },
          {
            fieldName: "Fire Escape Route Width",
            fieldType: "NUMBER",
            unit: "meters",
            condition: "GREATER_THAN",
            thresholdValue: 1.2,
            regulationRef: "Section 5.6",
            sortOrder: 6,
          },
        ],
      },
    },
    include: { items: true },
  })
  console.log(`  Created template: ${fireSafety.name} (${fireSafety.items.length} items)`)

  // Template 3: Environmental
  const environmental = await prisma.checklist.create({
    data: {
      name: "Environmental Compliance",
      description: "Environmental protection and sustainability requirements",
      category: "environmental",
      tags: ["environmental", "emissions", "waste"],
      sourceType: "TEMPLATE",
      isTemplate: true,
      orgId: org.id,
      createdById: admin.id,
      items: {
        create: [
          {
            fieldName: "CO2 Emissions",
            fieldType: "NUMBER",
            unit: "tons/year",
            condition: "LESS_THAN",
            thresholdValue: 500,
            regulationRef: "EPA Section 2.1",
            sortOrder: 1,
          },
          {
            fieldName: "Waste Recycling Rate",
            fieldType: "NUMBER",
            unit: "%",
            condition: "GREATER_THAN",
            thresholdValue: 30,
            regulationRef: "EPA Section 3.2",
            sortOrder: 2,
          },
          {
            fieldName: "Water Usage",
            fieldType: "NUMBER",
            unit: "liters/day",
            condition: "LESS_THAN",
            thresholdValue: 10000,
            regulationRef: "EPA Section 4.1",
            sortOrder: 3,
          },
          {
            fieldName: "Noise Level",
            fieldType: "NUMBER",
            unit: "dB",
            condition: "LESS_THAN",
            thresholdValue: 85,
            regulationRef: "EPA Section 5.1",
            sortOrder: 4,
          },
          {
            fieldName: "Air Quality Index",
            fieldType: "NUMBER",
            unit: "AQI",
            condition: "LESS_THAN",
            thresholdValue: 100,
            regulationRef: "EPA Section 6.1",
            sortOrder: 5,
          },
          {
            fieldName: "Hazardous Waste Disposal",
            fieldType: "TEXT",
            condition: "MUST_CONTAIN",
            thresholdValue: "certified",
            regulationRef: "EPA Section 7.1",
            sortOrder: 6,
          },
        ],
      },
    },
    include: { items: true },
  })
  console.log(`  Created template: ${environmental.name} (${environmental.items.length} items)`)

  console.log("\nSeeding complete!")
  console.log("─────────────────────────────────────────")
  console.log("Login credentials:")
  console.log("  Admin:    admin@demo.com / password123")
  console.log("  Auditor:  auditor@demo.com / password123")
  console.log("  Viewer:   viewer@demo.com / password123")
  console.log("─────────────────────────────────────────")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
