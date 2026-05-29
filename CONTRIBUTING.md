# Contributing to Minimal-Build

First off, thank you for considering contributing to Minimal-Build!

## 🚀 Getting Started

1. **Fork the repository** and clone it locally.
2. **Install dependencies** using `pnpm` (we use a pnpm workspace monorepo).
   ```bash
   pnpm install
   ```
3. **Set up the Database**. You can use the provided `docker-compose.yml` to spin up a local PostgreSQL instance:
   ```bash
   docker compose up -d
   ```
4. **Environment Variables**: Create a `.env` file in the root based on `.env.example` (or configure `DATABASE_URL` manually).
5. **Run Migrations**: 
   ```bash
   pnpm --filter @workspace/db run push
   ```

## 🏗️ Monorepo Structure

- `artifacts/api-server/`: The Express API and event ingestion pipeline.
- `artifacts/analytics/`: The frontend React dashboard.
- `lib/db/`: PostgreSQL database schema and queries (Drizzle ORM).
- `lib/api-spec/`: The OpenAPI 3.0 source of truth.

## ✅ Pull Request Process

1. Ensure all TypeScript types are correct by running `pnpm run typecheck`.
2. Format your code using Prettier (if configured).
3. Update the `README.md` or OpenAPI specs if you are making API changes.
4. Submit your PR against the `main` branch.

Happy coding!
