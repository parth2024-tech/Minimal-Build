# 📊 Minimal-Build Analytics

A lightweight, high-performance, and type-safe web analytics and event tracking system designed for modern applications. Built as a decoupled pnpm monorepo, it enables real-time visitor event ingestion, advanced dynamic segmentation, and interactive visual dashboards with complete privacy compliance.

---

## 🚀 Key Features

- **🌐 Decoupled Monorepo Architecture**: Clean separation of database schemas, API spec definitions, generated clients, frontend dash, and ingestion engines.
- **⚡ Ingest Rate Limiting**: Built-in rate limiting and body size limits to protect resources from traffic spikes.
- **🛡️ GDPR-Compliant IP Anonymization**: Automatically truncates incoming visitor IP addresses (e.g., `192.168.1.100` $\rightarrow$ `192.168.1.0`) to secure visitor privacy without sacrificing geographical region metrics.
- **🎯 Dynamic Cohort Segmentation**: A robust, type-safe Postgres segment compiler built on Drizzle ORM that safely compiles complex client filters into optimized SQL queries.
- **🔗 Single Source of Truth Specs**: OpenAPI 3.0 specs drive both runtime Zod validation and auto-generated React Query frontend SDK hooks.
- **🎨 Live Metrics Dashboard**: Modern dashboard displaying total events, unique page counts, top referrers, active live visitors, and custom workspace management.
- **🧪 Dynamic Mockup Sandbox**: Isolated preview environment with a custom Vite plugin that automatically watches and dynamically imports UI mockup components for local design workflows.

---

## 📁 Repository Structure

```
Minimal-Build/
├── 📁 artifacts/
│   ├── 📁 analytics/           # React + Vite analytics dashboard frontend
│   ├── 📁 api-server/           # Express event ingestion & database controller
│   └── 📁 mockup-sandbox/       # Component preview server & hot-reload canvas
├── 📁 lib/
│   ├── 📁 api-client-react/     # Auto-generated React Query API client SDK
│   ├── 📁 api-spec/             # OpenAPI 3.0 spec definition (openapi.yaml)
│   ├── 📁 api-zod/              # Auto-generated Zod runtime validation schemas
│   └── 📁 db/                   # Database schemas and Drizzle PostgreSQL connections
└── 📁 scripts/                  # Codegen, build, and development helper scripts
```

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Lucide Icons, Framer Motion, TanStack Query
- **Backend**: Node.js, Express, Pino Logger, Helmet
- **Database**: PostgreSQL, Drizzle ORM (Type-Safe SQL Generation)
- **Validation & Spec**: OpenAPI 3.0, Orval (Clientside Codegen), Zod (Schema parsing)
- **Monorepo Manager**: `pnpm` workspace

---

## 🏁 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (v8+ recommended)
- PostgreSQL database instance

### 1. Clone & Install Dependencies
Ensure you are using `pnpm` as the package manager:
```bash
git clone git@github.com:parth2024-tech/Minimal-Build.git
cd Minimal-Build
pnpm install
```

### 2. Configure Environment Variables
Set the connection string in your database layer:
Create a `.env` file in the root or database directory containing:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### 3. Generate API Clients & Schemas
Compile the OpenAPI specifications into runtime Zod schemas and React hooks:
```bash
pnpm run build
```

### 4. Run Development Servers
To start the services locally:
- **API Server & Analytics Dashboard**:
  ```bash
  pnpm --filter api-server dev
  pnpm --filter analytics dev
  ```
- **Mockup Sandbox Canvas**:
  ```bash
  pnpm --filter mockup-sandbox dev
  ```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
