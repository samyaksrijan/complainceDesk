# Compliance Desk

A multi-tenant workspace for compliance criteria, document evidence, AI-assisted evaluation, audit trails and reports. Roles: administrator, auditor and viewer.

## Local development

Use Node 22 LTS, PostgreSQL 15+ and npm. From `compliance-desk`:

```sh
cp .env.example .env
npm ci
npx prisma generate
```

Set a real `DATABASE_URL`, a random `NEXTAUTH_SECRET` and at least one AI provider key in `.env`. For local development, `STORAGE_DRIVER=local` stores uploads under `UPLOAD_DIR`. Set AWS region and a verified SES sender to enable recovery/invitations; otherwise those actions report that email delivery is unavailable.

```sh
npm run db:migrate
npm run dev
```

Register the first organization at `/register`. Optional local demo data: `npm run db:seed` (destructive; replaces data and refuses production). Demo users authenticate through PostgreSQL; there is no built-in password bypass.

On macOS with Homebrew PostgreSQL 17 installed, `brew services start postgresql@17` keeps the local database running across logins. Check `http://localhost:3000/api/health`: both `database` and `schema` should report `ok`. A service-unavailable sign-in message means the database connection or migrations need attention; changing the password will not resolve it. The development account buttons fill credentials and require the seeded users to exist.

With Docker, configure `.env`, then `docker compose up --build`. Compose starts PostgreSQL, applies migrations, and starts the application using persistent local volumes. This is a local configuration, not the AWS production profile.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

The integration runner starts a temporary PostgreSQL-compatible PGlite engine over the PostgreSQL wire protocol and the standalone production server. It uses mocked AI responses and a headless browser, exercises actual APIs and UI, and deletes its temporary database/files afterward. It never uses the development database. CI runs the same suite against a disposable PostgreSQL 15 service using `TEST_DATABASE_URL`. Install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; on macOS it can use an installed Google Chrome. Ports 15438 and 3417 must be free. Desktop/mobile screenshots go to ignored `test-results/`.

To include image OCR in the local integration run, download the pinned language asset with `node scripts/fetch-ocr-data.mjs /tmp/compliance-ocr-data`, then run `TEST_TESSERACT_LANG_PATH=/tmp/compliance-ocr-data npm run test:integration`. CI enables this check. The Docker build verifies and bundles the same model.

The new regression and integration suites replace the previous ad hoc scripts, which contained synthetic success assertions and required a running, mutable demo database.

## Production and AWS

See [verification results and remaining staging gates](docs/VERIFICATION.md) and the [AWS deployment runbook](docs/AWS_DEPLOYMENT.md) for environment configuration, S3/SES/RDS, IAM/OIDC, ECS task templates, billing, migrations, rollback and staging acceptance.

```sh
docker build --target runner -t compliance-desk:app .
docker build --target migrate -t compliance-desk:migrate .
```

Runtime: `node server.js` in the standalone container. The image runs as a non-root user and includes OCR English language data. Production starts only with validated configuration. Keep secrets in ECS/SSM, use a private S3 bucket, set HTTPS `NEXTAUTH_URL`, and configure SES. Do not seed demo accounts in production.

Analysis processes complete text in overlapping segments, flags conflicting evidence, and counts missing requirements against compliance. Documents above 240,000 extracted characters must be split. Original files and generated findings remain tenant-scoped. Reports are summaries of evaluation results, not regulatory certification.
