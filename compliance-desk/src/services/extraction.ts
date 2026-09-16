import fs from "fs"
import path from "path"

interface ExtractionResult {
  text: string
  pageCount?: number
  method: string
  error?: string
}

/**
 * Extract text from a file based on its type.
 * Supports: PDF, DOCX, PNG, JPG, TXT
 */
export async function extractText(
  filePath: string,
  fileType: string
): Promise<ExtractionResult> {
  const ext = fileType.toLowerCase()

  try {
    switch (ext) {
      case "pdf":
        return await extractFromPDF(filePath)
      case "docx":
        return await extractFromDOCX(filePath)
      case "png":
      case "jpg":
      case "jpeg":
        return await extractFromImage(filePath)
      case "txt":
        return await extractFromText(filePath)
      default:
        return {
          text: "",
          method: "none",
          error: `Unsupported file type: ${ext}`,
        }
    }
  } catch (error: any) {
    return {
      text: "",
      method: ext,
      error: `Extraction failed: ${error.message}`,
    }
  }
}

async function extractFromPDF(filePath: string): Promise<ExtractionResult> {
  const pdfParse = (await import("pdf-parse")).default
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)

  return {
    text: data.text,
    pageCount: data.numpages,
    method: "pdf-parse",
  }
}

async function extractFromDOCX(filePath: string): Promise<ExtractionResult> {
  const mammoth = await import("mammoth")
  const buffer = fs.readFileSync(filePath)
  const result = await mammoth.extractRawText({ buffer })

  return {
    text: result.value,
    method: "mammoth",
  }
}

async function extractFromImage(filePath: string): Promise<ExtractionResult> {
  const Tesseract = await import("tesseract.js")
  const result = await Tesseract.recognize(filePath, "eng", {
    logger: () => {}, // silence progress logs
  })

  return {
    text: result.data.text,
    method: "tesseract",
  }
}

async function extractFromText(filePath: string): Promise<ExtractionResult> {
  const text = fs.readFileSync(filePath, "utf-8")

  return {
    text,
    method: "direct-read",
  }
}

/**
 * Get the file type from filename extension.
 */
export function getFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(".", "")
  return ext
}

/**
 * Validate file type is supported.
 */
export function isSupportedFileType(fileType: string): boolean {
  const supported = ["pdf", "docx", "png", "jpg", "jpeg", "txt"]
  return supported.includes(fileType.toLowerCase())
}

/**
 * Validate file size.
 */
export function isWithinSizeLimit(sizeBytes: number, maxMB: number = 10): boolean {
  const maxBytes = maxMB * 1024 * 1024
  return sizeBytes <= maxBytes
}
