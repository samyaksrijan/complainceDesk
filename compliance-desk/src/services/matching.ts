import { prisma } from "@/lib/prisma"

interface MatchResult {
  matched: boolean
  checklistId: string | null
  checklistName: string | null
  confidence: number
  matchType: "auto" | "manual" | "none"
  suggestions: Array<{
    id: string
    name: string
    score: number
  }>
}

/**
 * Extract significant keywords from document text.
 * Returns lowercase unique words (3+ chars), excluding common stop words.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all",
    "can", "had", "her", "was", "one", "our", "out", "has",
    "this", "that", "with", "have", "from", "they", "been",
    "said", "each", "which", "their", "will", "other", "about",
    "many", "then", "them", "would", "like", "time", "very",
    "when", "come", "could", "more", "than", "also", "into",
    "shall", "must", "may", "per", "any", "its", "such",
    "section", "chapter", "article", "part",
  ])

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word))

  // Return unique words
  return [...new Set(words)]
}

/**
 * Score how well a checklist matches a document based on 
 * keyword overlap between document text and checklist metadata.
 */
function scoreChecklist(
  docKeywords: string[],
  checklist: {
    name: string
    description: string | null
    category: string | null
    tags: string[]
    items: Array<{ fieldName: string }>
  }
): number {

  // Build checklist keywords from all available text
  const checklistTexts = [
    checklist.name,
    checklist.description || "",
    checklist.category || "",
    ...checklist.tags,
    ...checklist.items.map((item) => item.fieldName),
  ].join(" ").toLowerCase()

  const checklistKeywords = extractKeywords(checklistTexts)
  const checklistKeywordSet = new Set(checklistKeywords)

  if (checklistKeywordSet.size === 0) return 0

  // Count overlapping keywords
  let overlap = 0
  for (const keyword of docKeywords) {
    if (checklistKeywordSet.has(keyword)) {
      overlap++
    }
  }

  // Score = overlap / total unique checklist keywords
  // Weighted slightly toward overlap ratio
  const overlapRatio = overlap / checklistKeywordSet.size
  const coverageRatio = overlap / Math.max(docKeywords.length, 1)

  return (overlapRatio * 0.7) + (coverageRatio * 0.3)
}

/**
 * Auto-match a document to the best checklist in the org.
 *
 * @param documentText - Extracted text from the document
 * @param orgId - Organization ID (to scope checklists)
 * @param threshold - Minimum confidence for auto-match (default 0.15)
 * @returns Match result with best match and suggestions
 */
export async function matchDocumentToChecklist(
  documentText: string,
  orgId: string,
  threshold: number = 0.15
): Promise<MatchResult> {
  // Get all checklists for this org (including templates)
  const checklists = await prisma.checklist.findMany({
    where: {
      OR: [
        { orgId },
        { isSystemTemplate: true },
      ],
    },
    include: {
      items: {
        select: { fieldName: true },
      },
    },
  })

  if (checklists.length === 0) {
    return {
      matched: false,
      checklistId: null,
      checklistName: null,
      confidence: 0,
      matchType: "none",
      suggestions: [],
    }
  }

  // Extract keywords from document
  const docKeywords = extractKeywords(documentText)

  // Score each checklist
  const scores = checklists.map((checklist) => ({
    id: checklist.id,
    name: checklist.name,
    score: scoreChecklist(docKeywords, checklist),
  }))

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score)

  // Take top 5 as suggestions
  const suggestions = scores.slice(0, 5).map((s) => ({
    id: s.id,
    name: s.name,
    score: Math.round(s.score * 100) / 100,
  }))

  const bestMatch = scores[0]
  const isConfident = bestMatch.score >= threshold

  return {
    matched: isConfident,
    checklistId: isConfident ? bestMatch.id : null,
    checklistName: isConfident ? bestMatch.name : null,
    confidence: Math.round(bestMatch.score * 100) / 100,
    matchType: isConfident ? "auto" : "none",
    suggestions,
  }
}
