# Compliance Desk — Review 2 Deliverables Dossier
**Project Name:** Compliance Desk  
**System Classification:** Enterprise Automated Compliance & Audit Management Platform  
**Target Architecture:** Next.js 15 App Router / TypeScript / PostgreSQL / Prisma / NextAuth / Docker / Groq LLaMA-3  
**Repository:** `https://github.com/Phantom1270/Compliance_Desk`  

---

## Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Cloud Architecture & Infrastructure](#2-cloud-architecture--infrastructure)
3. [Database Design & Schema](#3-database-design--schema)
4. [Entity Relationship (ER) Diagram](#4-entity-relationship-er-diagram)
5. [Module Design & Workflows](#5-module-design--workflows)
6. [API Design & Route Specifications](#6-api-design--route-specifications)
7. [Authentication & RBAC Matrix](#7-authentication--rbac-matrix)
8. [Core Modules Implementation Status](#8-core-modules-implementation-status)
9. [GitHub Repository & CI/CD Readiness](#9-github-repository--cicd-readiness)
10. [Initial Cloud Deployment & Runbook](#10-initial-cloud-deployment--runbook)

---

## 1. System Architecture

Compliance Desk is structured on a layered, modular SaaS architecture designed for high throughput document parsing, strict tenant isolation, and deterministic compliance verification.

```mermaid
graph TD
    subgraph Client_Layer ["Presentation Layer (Client)"]
        UI_Web["Next.js 15 Web Interface<br/>(Tailwind CSS, Poppins, Plus Jakarta Sans)"]
        State_Auth["NextAuth Session Provider & RBAC Context"]
    end

    subgraph App_Layer ["Application & API Layer (Next.js Server)"]
        API_Gateway["Next.js Route Handlers (/api/*)"]
        Auth_Guard["RBAC Middleware & Session Validator"]
        
        subgraph Core_Engines ["Core Processing Engines"]
            Doc_Engine["Document Parser Engine<br/>(PDF, DOCX, OCR Tesseract)"]
            Checklist_Engine["Checklist & Rule Matcher Engine"]
            LLM_Service["LLM Compliance Evaluator<br/>(Groq LLaMA-3 / Gemini 1.5)"]
            Report_Gen["Audit Report & PDF Generator<br/>(@react-pdf/renderer)"]
            Audit_Logger["Immutable Audit Logger"]
        end
    end

    subgraph Data_Layer ["Persistence & Storage Layer"]
        Prisma_ORM["Prisma ORM Client"]
        Postgres_DB[("PostgreSQL 15 Database<br/>(Tenants, Users, Evidence, Results)")]
        File_Store[("Storage Volume / S3<br/>(/uploads Encrypted Docs)")]
    end

    UI_Web --> State_Auth
    State_Auth --> API_Gateway
    API_Gateway --> Auth_Guard
    Auth_Guard --> Core_Engines
    Core_Engines --> Prisma_ORM
    Core_Engines --> File_Store
    Prisma_ORM --> Postgres_DB
```

---

## 2. Cloud Architecture & Infrastructure

The production topology leverages containerized micro-services and serverless edge delivery:

```mermaid
graph LR
    subgraph Users ["End Users"]
        Auditor["Auditor / Compliance Lead"]
    end

    subgraph Edge ["Edge / CDN Layer"]
        Cloudflare["Vercel Edge Network / Cloudflare CDN<br/>(SSL Termination, DDoS Mitigation)"]
    end

    subgraph Cloud_Compute ["Compute Cluster (Docker / Vercel / AWS ECS)"]
        App_Container["Next.js App Server (Node.js 20 Alpine)"]
    end

    subgraph AI_Providers ["AI Inference Engine"]
        Groq_API["Groq LPU Engine (LLaMA-3 70B / 8B)<br/>Low-latency JSON Extraction"]
        Gemini_Fallback["Google Gemini 1.5 Flash<br/>(Failover Provider)"]
    end

    subgraph Managed_Data ["Managed Cloud Persistence"]
        Managed_DB[("Neon / AWS RDS PostgreSQL<br/>(Automated Backups & SSL Pool)")]
        Blob_Storage[("AWS S3 / Cloudflare R2<br/>(Document Evidence Store)")]
    end

    Auditor --> Cloudflare
    Cloudflare --> App_Container
    App_Container --> Groq_API
    Groq_API -. Failover .-> Gemini_Fallback
    App_Container --> Managed_DB
    App_Container --> Blob_Storage
```

---

## 3. Database Design & Schema

The relational schema strictly enforces **Multi-Tenant Isolation** across organizations with referential integrity.

### Data Models Summary:
1. **`Organization`**: Tenant boundary ensuring zero cross-company data leakage.
2. **`User`**: Tenant members with role classifications (`ADMIN`, `AUDITOR`, `VIEWER`).
3. **`Document`**: Raw ingested compliance files with metadata, parsing status, and extracted text.
4. **`Checklist`**: Master standards (e.g., ISO 27001, SOC 2, HIPAA) or custom organization checklists.
5. **`ChecklistItem`**: Atomic checkpoint rules (Condition operators: `<`, `>`, `=`, `RANGE`, `MUST_CONTAIN`).
6. **`ComplianceResult`**: Certified evaluation run linking a Document with a Checklist.
7. **`ComplianceItemResult`**: Individual clause verdict (`PASS`, `FAIL`, `NOT_FOUND`, `NEEDS_REVIEW`) with citation notes.
8. **`AuditLog`**: Immutable append-only audit trail logging all actions, IPs, and user IDs.
9. **`Notification`**: Real-time system alerts for status updates and compliance checks.

---

## 4. Entity Relationship (ER) Diagram

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : "has members"
    ORGANIZATION ||--o{ DOCUMENT : "owns"
    ORGANIZATION ||--o{ CHECKLIST : "defines"
    ORGANIZATION ||--o{ AUDIT_LOG : "records"

    USER ||--o{ DOCUMENT : "uploads"
    USER ||--o{ CHECKLIST : "authors"
    USER ||--o{ AUDIT_LOG : "triggers"
    USER ||--o{ NOTIFICATION : "receives"

    CHECKLIST ||--o{ CHECKLIST_ITEM : "contains clauses"
    CHECKLIST ||--o{ COMPLIANCE_RESULT : "evaluates"

    DOCUMENT ||--o{ COMPLIANCE_RESULT : "generates"
    
    COMPLIANCE_RESULT ||--o{ COMPLIANCE_ITEM_RESULT : "records findings"
    CHECKLIST_ITEM ||--o{ COMPLIANCE_ITEM_RESULT : "evaluated against"

    ORGANIZATION {
        string id PK
        string name
        datetime createdAt
    }

    USER {
        string id PK
        string email UK
        string name
        string role "ADMIN | AUDITOR | VIEWER"
        string organizationId FK
    }

    DOCUMENT {
        string id PK
        string name
        string fileUrl
        string fileType
        string status "UPLOADED | PROCESSING | MATCHED | COMPLIANT | NON_COMPLIANT"
        string extractedText
        string organizationId FK
        string uploadedById FK
    }

    CHECKLIST {
        string id PK
        string name
        string description
        boolean isTemplate
        string sourceType "TEMPLATE | SCANNED | MANUAL"
        string organizationId FK
    }

    CHECKLIST_ITEM {
        string id PK
        string fieldName
        string fieldType "NUMBER | BOOLEAN | TEXT | SELECT"
        string condition "LESS_THAN | GREATER_THAN | EQUALS | RANGE | MUST_CONTAIN"
        string thresholdValue
        string unit
        string checklistId FK
    }

    COMPLIANCE_RESULT {
        string id PK
        float overallScore
        string status "COMPLIANT | NON_COMPLIANT"
        string summary
        string documentId FK
        string checklistId FK
    }

    COMPLIANCE_ITEM_RESULT {
        string id PK
        string status "PASS | FAIL | NOT_FOUND | NEEDS_REVIEW"
        string extractedValue
        string notes
        string complianceResultId FK
        string checklistItemId FK
    }

    AUDIT_LOG {
        string id PK
        string action
        string resourceType
        string resourceId
        string ipAddress
        string userId FK
        string organizationId FK
        datetime createdAt
    }
```

---

## 5. Module Design & Workflows

### 5.1 Document Ingestion & Text Extraction Pipeline
```mermaid
sequenceDiagram
    autonumber
    actor User as Auditor / Compliance Lead
    participant API as Ingestion API (/api/documents/upload)
    participant Parser as Extraction Engine (PDF/DOCX/OCR)
    participant DB as PostgreSQL (Prisma)

    User->>API: Multipart Form Upload (PDF / DOCX)
    API->>API: Validate MIME type, size (<10MB), and sanitize filename
    API->>Parser: Dispatch file buffer to parser
    alt Standard PDF / Text
        Parser->>Parser: Extract text stream
    else Scanned Document / Image
        Parser->>Parser: Execute Tesseract OCR pipeline
    end
    Parser-->>API: Extracted raw text buffer
    API->>DB: Create Document record (status: MATCHED or UNMATCHED)
    API->>DB: Append AUDIT_LOG entry (DOCUMENT_UPLOADED)
    API-->>User: 201 Created (Document ID & Metadata)
```

### 5.2 AI Compliance Verification Engine
```mermaid
sequenceDiagram
    autonumber
    actor User as Auditor
    participant API as Evaluation API (/api/documents/[id]/check)
    participant LLM as Groq LPU (LLaMA-3 70B)
    participant Evaluator as Rule Engine
    participant DB as PostgreSQL

    User->>API: Trigger Compliance Check
    API->>DB: Fetch Document text & Matched Checklist Items
    API->>LLM: Send structured prompt with schema-enforced JSON output
    LLM-->>API: Extracted field values & verbatim citations
    API->>Evaluator: Compare extracted values against Threshold conditions
    Evaluator->>Evaluator: Compute item verdicts (PASS/FAIL) & Overall Score
    API->>DB: Persist ComplianceResult & ComplianceItemResult records
    API->>DB: Update Document status to COMPLIANT or NON_COMPLIANT
    API-->>User: 200 OK (Full Evaluation Matrix & Scores)
```

---

## 6. API Design & Route Specifications

| HTTP Method | Route Endpoint | RBAC Guard | Description | Response Status |
|:---:|:---|:---:|:---|:---:|
| `POST` | `/api/auth/callback/credentials` | Public | NextAuth credential authentication | `200 OK` / `401 Unauthorized` |
| `POST` | `/api/auth/register` | Public | New tenant & admin onboarding | `201 Created` / `400 Bad Request` |
| `GET` | `/api/dashboard/stats` | Any Auth | Aggregated KPI scores, status counts | `200 OK` |
| `GET` | `/api/dashboard/activity` | Any Auth | Live tenant audit event timeline | `200 OK` |
| `GET` | `/api/documents` | Any Auth | Paginated document listing with filters | `200 OK` |
| `POST` | `/api/documents/upload` | `ADMIN`, `AUDITOR` | Upload and parse compliance document | `201 Created` |
| `GET` | `/api/documents/[id]` | Any Auth | Document details, extracted text & findings | `200 OK` |
| `POST` | `/api/documents/[id]/check` | `ADMIN`, `AUDITOR` | Execute AI automated compliance check | `200 OK` |
| `GET` | `/api/checklists` | Any Auth | List standard frameworks and checklists | `200 OK` |
| `POST` | `/api/checklists` | `ADMIN`, `AUDITOR` | Create checklist with conditional criteria | `201 Created` |
| `GET` | `/api/reports` | Any Auth | List completed compliance audit reports | `200 OK` |
| `GET` | `/api/audit-log` | `ADMIN`, `AUDITOR` | Query immutable audit log records | `200 OK` |
| `GET` | `/api/admin/users` | `ADMIN` Only | Member management directory | `200 OK` / `403 Forbidden` |
| `POST` | `/api/admin/users/invite`| `ADMIN` Only | Provision and invite new organization user| `201 Created` |

---

## 7. Authentication & RBAC Matrix

Authentication is implemented via **NextAuth.js (JWT Strategy)** with session-level role verification.

| Permission / Capability | Executive Viewer (`VIEWER`) | Senior Auditor (`AUDITOR`) | Compliance Lead (`ADMIN`) |
|:---|:---:|:---:|:---:|
| View Dashboard KPIs & Statistics | ✅ Yes | ✅ Yes | ✅ Yes |
| View Ingested Documents & Results | ✅ Yes | ✅ Yes | ✅ Yes |
| Download Certified PDF Reports | ✅ Yes | ✅ Yes | ✅ Yes |
| Upload New Regulatory Documents | ❌ Read Only | ✅ Yes | ✅ Yes |
| Create / Edit Checklists & Frameworks| ❌ Read Only | ✅ Yes | ✅ Yes |
| Trigger AI Verification Runs | ❌ Read Only | ✅ Yes | ✅ Yes |
| View Organization Audit Logs | ❌ Denied | ✅ Yes | ✅ Yes |
| Invite Members & Modify Roles | ❌ Denied | ❌ Denied | ✅ Yes |
| Delete Documents or Checklists | ❌ Denied | ❌ Denied | ✅ Yes |

---

## 8. Core Modules Implementation Status

- [x] **Authentication Engine**: Multi-role JWT sessions with sandbox demo fallback.
- [x] **Light UI Theme**: Professional slate/gold design system with Poppins and Plus Jakarta Sans typography.
- [x] **Multi-Page App Shell**: Unified navigation, notification drawer, breadcrumb system.
- [x] **Evidence Verification Studio**: Interactive split-screen review with clause citation spotlights.
- [x] **Framework Builder**: Condition rules (`<`, `>`, `=`, `RANGE`, `MUST_CONTAIN`).
- [x] **Report Generation**: Executive summary tables and PDF rendering.
- [x] **Audit Logging**: Structured event tracing with IP and actor metadata.

---

## 9. GitHub Repository & CI/CD Readiness

- **GitHub Remote**: `Phantom1270/Compliance_Desk`
- **Branch Strategy**: `main` (Production), `develop` (Feature branches)
- **Quality Gates**: ESLint v9, TypeScript typechecking, Prisma schema validation.
- **Docker Packaging**: Multi-stage `Dockerfile` and `docker-compose.yml` for zero-configuration team onboarding.

---

## 10. Initial Cloud Deployment & Runbook

### Environment Variables Template (`.env`):
```env
DATABASE_URL="postgresql://user:password@host:5432/compliance_desk?sslmode=require"
NEXTAUTH_URL="https://compliance-desk.yourdomain.com"
NEXTAUTH_SECRET="super-secure-production-secret-min-32-chars"
GROQ_API_KEY="gsk_..."
GEMINI_API_KEY="AIzaSy..."
LLM_PRIMARY_PROVIDER="groq"
UPLOAD_DIR="./uploads"
```

### 1-Click Deployment Instructions (Vercel):
1. Import repository `Phantom1270/Compliance_Desk` into Vercel.
2. Link Managed PostgreSQL database (e.g. Neon, Supabase, or Vercel Postgres).
3. Set environment variables in Vercel Project Settings.
4. Trigger production build (`npm run build`).
