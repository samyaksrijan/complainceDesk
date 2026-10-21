# Compliance Desk: AWS handoff

The application is packaged for a long-running Node 22 container. Keep its existing workflow: register an organization, manage criteria, upload and match documents, evaluate evidence, review results, generate reports, and manage members. The visual identity uses eucalyptus accents, ink text and warm neutral surfaces.

## What the repository prepares

- Database-backed authentication and immediate account/session revocation; recovery and invitations use hashed, expiring, single-use tokens delivered through SES.
- Private S3 storage selected with `STORAGE_DRIVER=s3`; authenticated downloads enforce organization ownership. Local storage is retained for development or an explicitly configured persistent volume.
- Full-text chunked AI extraction, missing-evidence penalties, conflict review, and atomic document evaluation claims. AI requests have per-request and overall analysis timeouts. The 240,000 character analysis limit returns an explicit error; split larger documents.
- Only server-provisioned system templates are shared across organizations; tenant-created or cloned templates remain private.
- Shared PostgreSQL rate-limit counters. Set `TRUST_PROXY=true` only when the ingress controls forwarding headers and users cannot connect directly to the app port.
- Reports aggregate within the HTTP request. No untracked process-local background task is required. For substantially larger workloads, move extraction/report generation into a durable queue/worker before increasing traffic.
- Standalone, non-root Docker runtime, a separate migration build target, bundled OCR language data, health checks, CI verification, and a manually triggered OIDC deployment workflow.

## Choose the hosting profile before provisioning

**Small pilot:** ECR + ECS on one EC2 host, Caddy for HTTPS, a private S3 bucket, SES, and PostgreSQL. Managed RDS is preferable for backup and recovery. A local PostgreSQL container with a dedicated EBS volume is cheaper in some cases but makes backup, patching and recovery your responsibility.

The supplied ECS task template uses bridge networking and fixed host port 3000. Caddy listens on 80/443 and forwards to `127.0.0.1:3000`. The deployment workflow uses `minimumHealthyPercent=0, maximumPercent=100`: expect a short interruption during replacement. It does not promise zero downtime. A single host is also a single point of failure.

Reserve at least 2 GiB for the application/OCR task and leave capacity for the ECS agent, OS, proxy and one-off migration task. Start capacity testing on a 4 GiB host; do not assume a 1 GiB micro instance can reliably run this workload. Measure memory with representative PDFs/images before downsizing. Build `linux/arm64` for ARM instances and `linux/amd64` for x86 instances. Set `runtimePlatform.cpuArchitecture` to `ARM64` or `X86_64` in both task definitions, matching the EC2 AMI and image platform.

**Production availability:** use an ALB, multiple ECS tasks across availability zones, private RDS, S3, and capacity for rolling replacement. Configure ingress idle timeouts for analysis or introduce a queue/worker. Budget for this profile separately.

## Billing comes first

Do not reuse the earlier $3.70/month estimate. Confirm account plan, credit balance/expiry, region, instance architecture/size, storage, database, public IPs, log retention and AI usage. AWS changed Free Tier for accounts created from July 15, 2025; eligibility and credits must be checked in the account. Public IPv4 has a published charge of $0.005 per address-hour before credits. A tunnel does not provide internet egress to IPv4-only services when the host has no public IPv4 or NAT path.

Set a monthly budget and email alerts before starting resources; alerts do not cap spending or stop resources. Include EC2, EBS/backups, RDS, S3 requests/storage, ECR images, SES, logs, DNS, public IPs, data transfer and Groq/Gemini charges. Avoid a NAT gateway for the single-host pilot unless its cost is explicitly accepted. Set ECR lifecycle rules, CloudWatch retention and S3 retention/version lifecycle rules.

Official references: [AWS Free Tier](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html), [VPC pricing](https://aws.amazon.com/vpc/pricing/), [ECS deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-failure-detection.html).

## Initial AWS setup

1. Pick the region, hostname, hosting profile and monthly budget. Configure AWS Budgets and billing notifications.
2. Create a private S3 bucket with Block Public Access, default encryption, versioning, and a retention lifecycle appropriate for compliance evidence. Do not expose S3 publicly or put AWS keys in the app.
3. Create PostgreSQL in the same region. For RDS, allow port 5432 only from the application host/security group, use encrypted storage and automatic backups, and configure a TLS connection string with certificate verification. Test a restore into a separate database before launch.
4. Verify the sending address/domain in SES, configure DKIM, and request production access if recipients are outside the SES sandbox. Test a recovery email and an invitation with controlled accounts. Delivery is unavailable until SES and IAM are configured; the application returns an error instead of displaying a false success or changing the existing password.
5. Put `DATABASE_URL`, `NEXTAUTH_SECRET` and provider keys in SSM SecureString parameters or Secrets Manager. Generate the auth secret with `openssl rand -base64 48`. ECS injects these at task startup; restart tasks after rotation. Set the nonsecret environment from `.env.example`, with HTTPS `NEXTAUTH_URL`, S3, region and verified sender.
6. Create ECR, the ECS cluster, and the EC2 capacity/instance role. Restrict SSH or use SSM Session Manager; restrict public inbound access to 80/443. Do not expose PostgreSQL or port 3000 to the internet.
7. Configure CloudWatch log groups with finite retention. Configure an ECS task execution role for image pulls, log publishing and reading the exact secret parameter ARNs. The application task role needs only S3 Put/Get/Delete for its bucket prefix and `ses:SendEmail` for the verified sender. The migration task only needs database credentials and execution permissions.
8. Substitute account/region/bucket/domain/role/parameter values in `docs/aws/task-definition.example.json`. Register it. Use `docs/aws/migration-task-definition.example.json` for the migration definition and the `migrate` Docker target, the database secret, no port mappings/health check, and the command `npx prisma migrate deploy`. Never run the demo seed in production.
9. Configure Caddy using `docs/aws/Caddyfile.example`, point DNS to the host, and verify HTTPS. For an ALB profile, replace the bridge/fixed-port template and the deployment workflow's networking/rolling configuration accordingly; the supplied workflow specifically targets the single-host EC2 profile.

## GitHub deployment setup

`.github/workflows/ci.yml` runs installation, Prisma generation, strict lint, type checking, regression tests, a production build, a high-severity production dependency gate, and a container build.

`.github/workflows/deploy.yml` is deliberately `workflow_dispatch`, so committing this code does not create resources or deploy it. It builds commit-tagged app/migration images, registers a migration revision, waits for successful migration, replaces the service task revision, and checks that the intended revision is healthy. The ECS circuit breaker can restore the prior completed service revision. The first deployment has no previous completed revision to restore.

Create a GitHub `production` environment restricted to the `main` branch and these variables:

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | Selected region |
| `AWS_DEPLOY_ROLE_ARN` | OIDC-assumable deployment role |
| `ECR_REPOSITORY` | Repository name, without registry prefix |
| `ECS_CLUSTER` | Existing EC2-backed cluster |
| `ECS_SERVICE` | Existing application service |
| `ECS_MIGRATION_FAMILY` | Existing migration task-definition family |
| `IMAGE_PLATFORM` | `linux/amd64` or `linux/arm64`, matching EC2 |

Restrict the IAM OIDC trust policy to this repository and `environment:production`; set the audience to `sts.amazonaws.com`. Scope deploy permissions to the ECR repository, ECS resources, and the exact roles passed with `iam:PassRole`. Do not store long-lived AWS access keys in GitHub. See [GitHub OIDC for AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).

The migration task must fit alongside the running service. If it cannot, ECS can leave it pending. Reserve capacity and monitor the migration job; never stop the application just to make an unreviewed schema change. Migrations in this change are additive except the audit foreign-key retention correction. Back up first. Later incompatible migrations need a separate expand/contract release plan.

## Staging acceptance and rollback

Use controlled accounts in a staging database/bucket. Verify registration/login for all roles; disabling a member and changing a password invalidates sessions; reset links are single-use and expire; invitations arrive; invalid users and cross-tenant identifiers are rejected. Upload PDF, DOCX, PNG/JPEG and TXT; restart the task and verify original downloads persist. Check missing-clause and conflicting-evidence cases, manual/automatic matching, repeated/concurrent evaluations, PDF export, reports, real dashboard counts, audit entries, notification actions, profile preferences, and mobile navigation.

`GET /api/health` verifies the database and reports provider configuration; it does not prove S3/SES permissions or successful AI calls. Validate those separately with real staging credentials. Measure OCR latency/memory and timeout behavior. Confirm credentials are absent from images/logs.

Keep the prior task revision and image SHA. Roll the service back to that task definition if application health or smoke tests fail. An application rollback does not roll back the database; retain additive migrations and restore a database only through the reviewed recovery procedure. Verify an RDS/EBS restore and S3 version recovery before relying on them.

Local verification is not an AWS deployment test. Linux container build/runtime, real S3/SES/provider access, IAM, HTTPS, backups and billing controls are final staging gates.
