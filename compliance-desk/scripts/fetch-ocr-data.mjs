import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
const directory = process.argv[2]
if (!directory) throw new Error("Usage: node scripts/fetch-ocr-data.mjs <directory>")
const response = await fetch("https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz", { signal: AbortSignal.timeout(120000) })
if (!response.ok) throw new Error(`OCR data download failed: ${response.status}`)
const data = Buffer.from(await response.arrayBuffer())
const expected = "ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468"
if (createHash("sha256").update(data).digest("hex") !== expected) throw new Error("OCR model checksum does not match the reviewed asset")
await mkdir(directory, { recursive: true })
await writeFile(path.join(directory, "eng.traineddata.gz"), data)
console.log("English OCR model downloaded and verified.")
