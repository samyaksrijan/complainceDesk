# Compliance Desk

**Compliance Desk** is an AI-powered compliance management application designed to automate and track organizational compliance. It seamlessly combines role-based document analysis, intelligent compliance checklists, and high-level reporting into a unified, responsive dashboard.

## 🚀 Project Status

The core foundation (Phases F1 through F11) is fully implemented. The application is ready for demonstration and hand-off, featuring a complete UI/UX, database schema, authentication system, and simulated AI-processing flows.

### Completed Features (F1 - F11)
- **F1: Authentication & RBAC**: Secure NextAuth implementation with Role-Based Access Control (`ADMIN`, `AUDITOR`, `VIEWER`).
- **F2: Checklists Module**: Create, manage, and clone compliance checklists.
- **F3: Document Management**: Upload center with drag-and-drop, PDF support, and status tracking.
- **F4: AI Compliance Analysis**: Document detail view featuring a simulated async AI compliance processor that scores documents against checklists.
- **F5: Dashboard Overview**: At-a-glance metrics, charts, and recent activity feeds.
- **F6: Audit Log**: Comprehensive, filterable chronological history of all user actions across the app with CSV export.
- **F7: User Settings & Profile**: Self-service profile management, password updates, and notification preferences.
- **F8: Admin User Management**: Interface for admins to invite users, change roles, and deactivate accounts securely.
- **F9: Notifications Center**: Real-time notification bell, dropdown feed, and dedicated inbox page.
- **F10: Compliance Reports**: Generate organizational-level compliance reports and export them as paginated PDFs.
- **F11: Polish & Integration**: Global Error Boundaries, global `Cmd+K` command palette search, onboarding modals, responsive mobile sidebar, and dynamic page metadata.

## 🛠 Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Database**: PostgreSQL (containerized via Docker)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Authentication**: [NextAuth.js (v4)](https://next-auth.js.org/)
- **Icons**: Lucide React

## 💻 Setup & Installation Workflow

To get the project running from scratch on a new machine, follow this workflow:

### 1. Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) & Docker Compose
- Git

### 2. Environment Variables
Create a `.env` file in the root of the project by copying the example:
```bash
cp .env.example .env
```
Ensure the `DATABASE_URL` is set correctly for your local Postgres instance.

### 3. Start the Database
Spin up the PostgreSQL database using Docker:
```bash
docker-compose up -d
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Push Schema & Seed Database
Sync the Prisma schema to the database and populate it with initial data (users and demo checklists):
```bash
npx prisma db push
npx prisma db seed
```

### 6. Run the Application
Start the Next.js development server:
```bash
npm run dev
```
Navigate to `http://localhost:3000` in your browser.

## 🔐 Default Demo Accounts

The database seed creates three demo accounts to test different RBAC permission levels:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@demo.com` | `password123` | Full access. Can manage users, edit checklists, and upload documents. |
| **Auditor** | `auditor@demo.com` | `password123` | Can upload documents, run analyses, and generate reports. Cannot manage users. |
| **Viewer** | `viewer@demo.com` | `password123` | Read-only access to dashboards, reports, and logs. |

## 🏗 Main Application Workflow

1. **Onboarding**: A new user lands on the Dashboard and is greeted with a setup modal.
2. **Define Checklists**: Admins/Auditors create Checklists representing organizational standards (e.g., "Fire Safety", "Data Protection").
3. **Upload Documents**: Users upload policy documents via the Documents page.
4. **AI Analysis (Simulated)**: The user runs an analysis on a Document against a Checklist. The app enters a `PROCESSING` state (polling in the background).
5. **Review Results**: Once `COMPLIANT` or `NON_COMPLIANT`, the user views the detailed breakdown score and itemized criteria results.
6. **Generate Reports**: Auditors synthesize multiple document analyses into a unified Report and export it as a PDF for stakeholders.
7. **Audit & Monitor**: Every action is recorded in the Audit Log, and status updates trigger Notifications.

## 🚀 Left to Implement (Future Enhancements)

While the core functionality and frontend integration are complete, the following areas require backend implementation for a production-ready release:

1. **Real LLM Integration**: The current document analysis (`src/app/api/documents/[id]/match/route.ts`) simulates AI processing with a `setTimeout` delay. This needs to be hooked up to an actual LLM pipeline (e.g., OpenAI API, LangChain) and a PDF text-extraction microservice.
2. **Actual File Storage (S3)**: Document uploads are currently handled logically in the database. A real production app needs file binaries uploaded securely to AWS S3 (or similar blob storage) with presigned URLs.
3. **Email Provider Integration**: Password resets, user invitations, and email notifications currently log to the console or use simulated delays. Integration with an email service like Resend or SendGrid is required.
4. **Multi-Tenant Architecture**: If deploying as a SaaS, the database schema requires robust multi-tenant enforcement (e.g., isolating Workspaces/Organizations) via Prisma middleware or Row-Level Security (RLS).
5. **Production CI/CD**: Setup GitHub Actions for testing, linting, and automated deployments (e.g., Vercel or AWS).
