import fs from "fs"
import path from "path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads")

async function cleanup() {
  console.log("Scanning for orphaned files...")
  console.log(`Upload directory: ${UPLOAD_DIR}`)

  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log("Upload directory does not exist. Nothing to clean up.")
    return
  }

  // Get all file paths referenced in the database
  const documents = await prisma.document.findMany({
    select: { fileUrl: true },
  })
  const dbPaths = new Set(documents.map((d) => d.fileUrl))

  // Get all org directories
  const orgDirs = fs.readdirSync(UPLOAD_DIR)
  let deleted = 0
  let scanned = 0

  for (const orgDir of orgDirs) {
    const orgPath = path.join(UPLOAD_DIR, orgDir)
    if (!fs.statSync(orgPath).isDirectory()) continue

    const files = fs.readdirSync(orgPath)
    for (const file of files) {
      scanned++
      const fullPath = path.join(orgPath, file)
      const relativePath = `uploads/${orgDir}/${file}`

      if (!dbPaths.has(relativePath) && !dbPaths.has(fullPath)) {
        try {
          fs.unlinkSync(fullPath)
          deleted++
          console.log(`  Deleted: ${relativePath}`)
        } catch (err) {
          console.error(`  Failed to delete: ${relativePath}`, err)
        }
      }
    }
  }

  console.log(`\nCleanup complete.`)
  console.log(`  Scanned: ${scanned} files`)
  console.log(`  Deleted: ${deleted} orphaned files`)
  console.log(`  Kept: ${scanned - deleted} referenced files`)
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
