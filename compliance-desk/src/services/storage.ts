import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

const root = () => path.resolve(process.env.UPLOAD_DIR || "./uploads")
const s3 = () => new S3Client({ region: process.env.AWS_REGION })
function bucket() { if (!process.env.S3_BUCKET) throw new Error("S3_BUCKET is required"); return process.env.S3_BUCKET }
function localPath(file: string) {
  const resolved = path.resolve(file)
  if (!resolved.startsWith(root() + path.sep)) throw new Error("Invalid storage path")
  return resolved
}
function objectKey(file: string) {
  if (!file.startsWith("s3://" + bucket() + "/")) throw new Error("Invalid object location")
  return file.slice(`s3://${bucket()}/`.length)
}
export async function saveFile(orgId: string, originalFilename: string, data: Buffer): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(orgId)) throw new Error("Invalid organization ID")
  const filename = `${randomUUID()}-${path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160)}`
  const key = `${orgId}/${filename}`
  if (process.env.STORAGE_DRIVER === "s3") {
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: data, ServerSideEncryption: "AES256" }))
    return `s3://${bucket()}/${key}`
  }
  const location = path.join(root(), key)
  await fs.mkdir(path.dirname(location), { recursive: true })
  await fs.writeFile(location, data, { flag: "wx" })
  return location
}
export async function readFile(file: string): Promise<Buffer> {
  if (!file.startsWith("s3://")) return fs.readFile(localPath(file))
  const response = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: objectKey(file) }))
  if (!response.Body) throw new Error("Object has no content")
  return Buffer.from(await response.Body.transformToByteArray())
}
export async function deleteFile(file: string): Promise<boolean> {
  if (file.startsWith("s3://")) await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: objectKey(file) }))
  else {
    try { await fs.unlink(localPath(file)) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error }
  }
  return true
}
export async function fileExists(file: string): Promise<boolean> {
  try {
    if (file.startsWith("s3://")) await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: objectKey(file) }))
    else await fs.access(localPath(file))
    return true
  } catch { return false }
}
