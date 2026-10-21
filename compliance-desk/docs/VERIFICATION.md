# Verification and handoff — October 21, 2026

Applies to the current working tree. The application is prepared for AWS staging; the AWS-specific acceptance gates below require the target account and infrastructure.

## Completed verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, zero errors or warnings |
| `npm test` | Pass, 34 tests across 7 suites |
| `npm run build` | Pass, Next.js 16.4.2 standalone production build |
| `TEST_TESSERACT_LANG_PATH=/tmp/compliance-ocr-data npm run test:integration` | Pass against the standalone production server |
| Migration/schema comparison | No drift after applying the checked-in migrations to an empty isolated test database |
| Browser runtime errors | None in the tested main-browser flows |
| Desktop/mobile layout | Screenshots inspected; mobile overflow and navigation close behavior checked |
| Production dependency audit | Zero critical/high/low findings; one moderate advisory reported across 3 CLI-chain packages |
| Dependency tree / whitespace | `npm ls --depth=0` and `git diff --check` pass |
| Compose and GitHub workflow YAML | Parsed successfully |

Local verification ran on Node 25.6.1/macOS. The deployment image and CI target Node 22 LTS. Docker is unavailable on this host, so Linux container execution is a separate gate, not a claimed local test result.

The integration runner uses an isolated PGlite PostgreSQL-compatible engine over the PostgreSQL wire protocol and the actual Prisma query/migration engines. CI is configured to run the same suite against a disposable PostgreSQL 15 service; that remote workflow has not been executed here. The developer's configured database was not migrated, seeded or modified.

## Workflows exercised

- No hardcoded demo authentication bypass; real registration and credential login.
- Automatic onboarding, desktop layout, mobile layout/navigation, and real dashboard counts.
- Real PDF, DOCX, TXT and PNG ingestion; image OCR uses the checksum-pinned English model.
- Browser file selection/upload, tenant-scoped matching, missing-clause scoring (1 pass + 4 missing = 20%, NON_COMPLIANT), result detail and actual PDF export.
- Report generation and aggregates, profile/preferences persistence, audit entries and notification deletion.
- Invitations and one-time password setup through a local SES-protocol test endpoint; reset-token replay rejection; viewer restrictions and immediate access loss after deactivation.
- Rejection of cross-tenant document/report access and report generation; correct empty-report failures; document deletion and empty-list behavior.

Unit tests additionally cover localized numeric measurements, ambiguous/conflicting evidence, select-value correctness, empty checklists, long-document coverage, S3 SDK behavior, local storage containment, oversized request bodies, password/session invalidation, last-administrator guards and safe CSV output.

AI responses and SES transport are mocked locally. No email was delivered to external recipients. S3 calls are mocked in unit tests; successful IAM/S3/SES/provider operation in AWS is not inferred from those mocks.

## Dependency advisory disposition

Next.js was upgraded from 16.3.4 to 16.4.2, and compatible dependency updates removed the critical/high production advisories.

`npm audit --omit=dev` still reports the moderate `sprintf-js` advisory through Mammoth's command-line `argparse` dependency (3 affected package entries, not 3 independent defects). The application uses Mammoth's library extraction API. Inspection confirms `argparse` is imported by `mammoth/bin/mammoth`, and neither `argparse` nor `sprintf-js` is present in the standalone application bundle. A forced downgrade to Mammoth 0.3.x would regress the supported parser and was not applied. Monitor the upstream fix.

The full development-tree audit also reports the high `braces` advisory through Next's ESLint/fast-glob toolchain. Its inputs here are trusted repository patterns, and it is absent from the deployed runtime. The scanner proposes a breaking ESLint/Next tooling downgrade; that was not applied. Organizations requiring a clean development dependency audit need an upstream patch or a separately reviewed tooling replacement.

## AWS staging gates

Follow [the deployment runbook](AWS_DEPLOYMENT.md). Before calling the service production-ready, validate the Linux image, real S3 persistence across restarts, SES deliverability/sandbox status, configured AI access and extraction quality, RDS TLS and restore, domain/HTTPS, IAM/OIDC scope, resource memory under representative OCR/concurrent workloads, health checks, release rollback, log retention, and account-specific cost/credit limits.

The single-host task/workflow templates intentionally allow a brief replacement interruption. They do not provide multi-instance availability. No AWS resources were provisioned or deployment workflow triggered during this work.
