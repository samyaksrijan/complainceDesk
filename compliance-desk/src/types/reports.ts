export interface ReportContent {
  id: string
  name: string
  status: "GENERATING" | "READY" | "FAILED"
  error?: string
  generatedBy: { name: string }
  createdAt: string
  completedAt: string | null
  checklistName?: string | null
  dateRange?: { from: string; to: string } | null
  includeDetails: boolean
  includeRecommendations: boolean
  summary: {
    totalDocuments: number; compliantCount: number; nonCompliantCount: number; averageScore: number
    highestScore: { documentId: string; documentName: string; score: number }
    lowestScore: { documentId: string; documentName: string; score: number }
  }
  sectionBreakdown: Array<{ sectionTitle: string; averageScore: number; passCount: number; failCount: number; warningCount: number }>
  documentResults: Array<{ documentId: string; documentName: string; score: number; status: string; sectionScores: Array<{ title: string; score: number; status: string }>; findings?: Array<{ clause: string; result: string; detail: string; recommendation?: string }> }>
}
