import { Router } from "express";
import NodeCache from "node-cache";
import { z } from "zod";
import {
  fetchAnalyticsSummary,
  fetchEventNames,
  fetchLiveStats,
  fetchTimeseries,
  fetchTopPages,
  fetchTopReferrers,
  fetchWorkspaceSegments,
  getSegmentContext,
} from "../lib/analytics-queries";

const router = Router();

const dashboardCache = new NodeCache({ stdTTL: 60 });

const DashboardSummaryQuery = z.object({
  workspaceId: z.string().uuid(),
  days: z.coerce.number().int().positive().max(365).optional().default(30),
  eventName: z.string().min(1).optional(),
  segmentId: z.string().uuid().optional(),
});

export type DashboardSummaryPayload = {
  summary: Awaited<ReturnType<typeof fetchAnalyticsSummary>>;
  timeseries: Awaited<ReturnType<typeof fetchTimeseries>>;
  topPages: Awaited<ReturnType<typeof fetchTopPages>>;
  topReferrers: Awaited<ReturnType<typeof fetchTopReferrers>>;
  eventNames: string[];
  liveStats: Awaited<ReturnType<typeof fetchLiveStats>>;
  segments: Awaited<ReturnType<typeof fetchWorkspaceSegments>>;
};

function cacheKey(workspaceId: string, days: number, eventName?: string, segmentId?: string): string {
  return `dashboard:${workspaceId}:${days}:${eventName ?? ""}:${segmentId ?? ""}`;
}

/**
 * Single batched dashboard payload — replaces 7 parallel client round-trips.
 * Cached in-memory for 60 seconds per workspace/filter combination.
 */
router.get("/dashboard/summary", async (req, res) => {
  const parsed = DashboardSummaryQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { workspaceId, days, eventName, segmentId } = parsed.data;
  const key = cacheKey(workspaceId, days, eventName, segmentId);

  const cached = dashboardCache.get<DashboardSummaryPayload>(key);
  if (cached) {
    res.json(cached);
    return;
  }

  const segment = await getSegmentContext(workspaceId, segmentId);

  const [summary, timeseries, topPages, topReferrers, eventNames, liveStats, segments] =
    await Promise.all([
      fetchAnalyticsSummary(workspaceId, days, segment),
      fetchTimeseries(workspaceId, days, eventName, segment),
      fetchTopPages(workspaceId, days, 10, segment),
      fetchTopReferrers(workspaceId, days, 10, segment),
      fetchEventNames(workspaceId),
      fetchLiveStats(workspaceId),
      fetchWorkspaceSegments(workspaceId),
    ]);

  const payload: DashboardSummaryPayload = {
    summary,
    timeseries,
    topPages,
    topReferrers,
    eventNames,
    liveStats,
    segments,
  };

  dashboardCache.set(key, payload);
  res.json(payload);
});

export default router;
