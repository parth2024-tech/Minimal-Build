import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

const ANALYTICS_VIEW_NAMES = [
  "daily_sessions_mv",
  "daily_page_stats_mv",
  "daily_referrer_stats_mv",
  "daily_event_stats_mv",
] as const;

/**
 * Concurrently refreshes all analytics materialized views.
 * Safe to call from cron, startup, or the standalone refresh job.
 */
export async function refreshAnalyticsViews(): Promise<void> {
  logger.info("Refreshing analytics materialized views...");
  for (const viewName of ANALYTICS_VIEW_NAMES) {
    await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`));
  }
  logger.info("Analytics materialized views refreshed.");
}
