import { prisma } from "@/lib/prisma"

export async function GET() {
  const checks: Record<string, string> = {}
  let healthy = true

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = "ok"
  } catch (error) {
    checks.database = "error"
    healthy = false
  }

  // LLM provider check (optional — only if keys are set)
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "gsk-your-groq-key-here") {
    checks.groq = "configured"
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your-gemini-key-here") {
    checks.gemini = "configured"
  }

  return Response.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  )
}
