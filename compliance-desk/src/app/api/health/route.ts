import { prisma } from "@/lib/prisma"

export async function GET() {
  const checks: Record<string, string> = {}
  let healthy = true

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = "ok"
    const [schema] = await prisma.$queryRaw<Array<{ ready: boolean }>>`SELECT to_regclass('public."PasswordResetToken"') IS NOT NULL AND to_regclass('public."RateLimit"') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Checklist' AND column_name = 'isSystemTemplate') AS ready`
    checks.schema = schema?.ready ? "ok" : "migration required"
    if (!schema?.ready) healthy = false
  } catch {
    checks.database = "error"
    healthy = false
  }

  // LLM provider check (optional — only if keys are set)
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "gsk-your-groq-key-here") {
    checks.groq = "Configured"
    checks.groqModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b"
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your-gemini-key-here") {
    checks.gemini = "Configured"
    checks.geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"
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
