import { refreshAnalyticsViews } from "../lib/refresh-analytics-views";
import { logger } from "../lib/logger";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let refreshTimer: ReturnType<typeof setInterval> | undefined;

/**
 * In-app fallback when pg_cron is unavailable (local dev, Docker without pg_cron).
 * pg_cron remains the preferred path in production — see lib/db/migrations/001_analytics_materialized_views.sql
 */
export function startAnalyticsViewRefreshScheduler(): void {
  if (refreshTimer) return;

  const run = () => {
    refreshAnalyticsViews().catch((err) => {
      logger.error({ err }, "Scheduled analytics MV refresh failed");
    });
  };

  // Initial refresh shortly after boot so dashboards aren't stale on deploy.
  setTimeout(run, 10_000);
  refreshTimer = setInterval(run, REFRESH_INTERVAL_MS);
  logger.info({ intervalMinutes: 5 }, "Analytics MV refresh scheduler started");
}

export function stopAnalyticsViewRefreshScheduler(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}
