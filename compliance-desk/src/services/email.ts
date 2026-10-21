import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"

export function emailConfigured() { return !!(process.env.EMAIL_FROM && process.env.AWS_REGION) }

export async function sendAccountLink(email: string, name: string, token: string, invitation = false) {
  if (!emailConfigured()) throw new Error("Email delivery is not configured. Set EMAIL_FROM and AWS_REGION.")
  const base = process.env.NEXTAUTH_URL
  if (!base) throw new Error("NEXTAUTH_URL is required for account links")
  const link = new URL("/reset-password", base)
  link.searchParams.set("token", token)
  const subject = invitation ? "Your Compliance Desk invitation" : "Reset your Compliance Desk password"
  await new SESv2Client({ region: process.env.AWS_REGION, endpoint: process.env.SES_ENDPOINT }).send(new SendEmailCommand({
    FromEmailAddress: process.env.EMAIL_FROM,
    Destination: { ToAddresses: [email] },
    Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: `Hello ${name},\n\n${invitation ? "You have been invited to Compliance Desk. Set your password" : "Reset your password"} using this link:\n\n${link}\n\nThis single-use link expires in one hour. If you did not request this, you can ignore this email.` } } } },
  }))
}
