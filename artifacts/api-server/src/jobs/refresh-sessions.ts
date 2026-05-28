import { refreshMaterializedView } from "drizzle-orm/pg-core";
import { db, dailySessionsMv } from "@workspace/db";
import { logger } from "../lib/logger";

async function refreshSessions() {
  logger.info("Starting concurrent refresh of daily_sessions_mv...");
  try {
    await db.execute(refreshMaterializedView(dailySessionsMv).concurrently());
    logger.info("Successfully refreshed daily_sessions_mv.");
  } catch (err) {
    logger.error({ err }, "Failed to refresh daily_sessions_mv.");
    process.exit(1);
  }
  process.exit(0);
}

import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  refreshSessions();
}
