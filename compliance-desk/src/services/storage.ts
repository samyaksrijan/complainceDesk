import fs from "fs"
import path from "path"

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads"

/**
 * Ensure directory exists, create if not.
 */
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Save an uploaded file to disk.
 * Returns the relative file path for database storage.
 */
export async function saveFile(
  orgId: string,
  originalFilename: string,
  fileBuffer: Buffer
): Promise<string> {
  const orgDir = path.join(UPLOAD_DIR, orgId)
  ensureDir(orgDir)

  // Generate unique filename: timestamp-sanitized-original
  const timestamp = Date.now()
  const sanitized = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const filename = `${timestamp}-${sanitized}`
  const filePath = path.join(orgDir, filename)

  fs.writeFileSync(filePath, fileBuffer)

  // Return relative path (for DB storage and later retrieval)
  return filePath
}

/**
 * Read a file from disk.
 */
export function readFile(filePath: string): Buffer {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath)
}

/**
 * Delete a file from disk.
 */
export function deleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Check if file exists.
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}
