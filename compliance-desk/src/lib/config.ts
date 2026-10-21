export function validateRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return
  const missing = ["DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "AWS_REGION", "EMAIL_FROM"].filter(key => !env[key])
  if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) missing.push("GROQ_API_KEY or GEMINI_API_KEY")
  if (env.STORAGE_DRIVER !== "s3" && env.ALLOW_LOCAL_STORAGE !== "true") missing.push("STORAGE_DRIVER=s3 (or ALLOW_LOCAL_STORAGE=true with a persistent volume)")
  if (env.STORAGE_DRIVER === "s3" && !env.S3_BUCKET) missing.push("S3_BUCKET")
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`)
  if ((env.NEXTAUTH_SECRET?.length || 0) < 32 || /dev-secret|replace-with|change-this/i.test(env.NEXTAUTH_SECRET || "")) throw new Error("NEXTAUTH_SECRET must be a unique random secret of at least 32 characters")
  if (!env.NEXTAUTH_URL?.startsWith("https://") && env.ALLOW_HTTP !== "true") throw new Error("NEXTAUTH_URL must use HTTPS")
}
