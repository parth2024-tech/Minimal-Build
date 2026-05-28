# PrivatePulse

Privacy-first web analytics SaaS — simple, GDPR-compliant event tracking for startups and SMEs who want Plausible-style insights without the Mixpanel price tag.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/analytics run dev` — run the dashboard frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui + Recharts
- API: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (workspaces, api_keys, events)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/analytics/src/` — React dashboard frontend
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — auto-generated Zod schemas for server validation (do not edit)

## Architecture decisions

- No Kafka / ClickHouse / K8s — plain Postgres scales to 10M events/day with proper indexing.
- IP anonymization on ingest: only the /24 mask (last octet zeroed) is stored.
- API keys are stored as SHA-256 hashes; the plaintext secret is shown only once on creation.
- Analytics queries aggregate in SQL — no materialized views for MVP, easy to add later.
- Live stats endpoint polls every 10s in the frontend; only queries the last 5 minutes.

## Product

- **Event ingestion** — `POST /api/v1/event` accepts workspace ID, event name, URL, referrer, and custom properties. IP is anonymized on write.
- **Analytics dashboard** — events over time (area chart), top pages, top referrers, summary stats with period comparison, live counter.
- **Date range filtering** — 7 / 30 / 90 day windows; filter by event name.
- **Workspace management** — multiple workspaces, each with its own API keys and data.
- **API key management** — create named keys, copy the secret once on creation, delete old keys.
- **JS snippet** — copy-pasteable tracking snippet shown in workspace settings.

## User preferences

- Minimum TypeScript — avoid it where possible; keep things pragmatic.

## Gotchas

- Always re-run codegen after editing `lib/api-spec/openapi.yaml`.
- Body schema names in the spec must be entity-shaped (e.g. `WorkspaceInput`), never `CreateWorkspaceBody` — Orval emits that name itself and a collision breaks the typecheck.
- Do not run `pnpm dev` at workspace root — use workflow restart instead.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
