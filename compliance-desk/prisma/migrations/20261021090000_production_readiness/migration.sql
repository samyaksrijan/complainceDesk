ALTER TABLE "User" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "analysisCompleteNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "weeklyDigest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_userId_fkey";
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "PasswordResetToken" ("tokenHash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "RateLimit" ("key" TEXT PRIMARY KEY, "count" INTEGER NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

ALTER TABLE "Document" ADD COLUMN "processingStartedAt" TIMESTAMP(3);

ALTER TABLE "Checklist" ADD COLUMN "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false;
-- Recognize the trusted demo catalog; tenant-created templates remain private.
UPDATE "Checklist" c SET "isSystemTemplate" = true
FROM "User" u, "Organization" o
WHERE c."createdById" = u.id AND c."orgId" = o.id
AND u.email = 'admin@demo.com' AND o.name = 'Demo Corp'
AND c."sourceType" = 'TEMPLATE' AND c."isTemplate" = true;

CREATE INDEX "Checklist_isSystemTemplate_idx" ON "Checklist"("isSystemTemplate");
