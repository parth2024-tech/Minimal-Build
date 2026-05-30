import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  GetAnalyticsSummaryQueryParams,
  GetTimeseriesQueryParams,
  GetTopPagesQueryParams,
  GetTopReferrersQueryParams,
  GetEventNamesQueryParams,
  GetLiveStatsQueryParams,
  GetFunnelQueryParams,
  GetRetentionQueryParams,
} from "@workspace/api-zod";
import { withGuardrails } from "../lib/guardrails";
import { toDayStart } from "../lib/analytics-source";
import {
  fetchAnalyticsSummary,
  fetchEventNames,
  fetchLiveStats,
  fetchTimeseries,
  fetchTopPages,
  fetchTopReferrers,
  getSegmentContext,
} from "../lib/analytics-queries";

const router = Router();

router.get("/analytics/summary", async (req, res) => {
  const parsed = GetAnalyticsSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { workspaceId, days = 7, segmentId } = parsed.data;
  const segment = await getSegmentContext(workspaceId, segmentId ?? undefined);
  res.json(await fetchAnalyticsSummary(workspaceId, days, segment));
});

router.get("/analytics/timeseries", async (req, res) => {
  const parsed = GetTimeseriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { workspaceId, days = 7, eventName, segmentId } = parsed.data;
  const segment = await getSegmentContext(workspaceId, segmentId ?? undefined);
  res.json(await fetchTimeseries(workspaceId, days, eventName, segment));
});

router.get("/analytics/top-pages", async (req, res) => {
  const parsed = GetTopPagesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { workspaceId, days = 7, limit = 10, segmentId } = parsed.data;
  const segment = await getSegmentContext(workspaceId, segmentId ?? undefined);
  res.json(await fetchTopPages(workspaceId, days, limit, segment));
});

router.get("/analytics/top-referrers", async (req, res) => {
  const parsed = GetTopReferrersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { workspaceId, days = 7, limit = 10, segmentId } = parsed.data;
  const segment = await getSegmentContext(workspaceId, segmentId ?? undefined);
  res.json(await fetchTopReferrers(workspaceId, days, limit, segment));
});

router.get("/analytics/event-names", async (req, res) => {
  const parsed = GetEventNamesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.json(await fetchEventNames(parsed.data.workspaceId));
});

router.get("/analytics/live", async (req, res) => {
  const parsed = GetLiveStatsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.json(await fetchLiveStats(parsed.data.workspaceId));
});

router.get("/analytics/funnel", async (req, res) => {
  const parsed = GetFunnelQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { workspaceId, step1Event, step2Event, step3Event, days = 7 } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const result = await withGuardrails(workspaceId, async (tx, isSampled) => {
      const tableRef = isSampled ? sql`events TABLESAMPLE SYSTEM (10)` : sql`events`;

      const funnelQuery = sql`
        WITH step1 AS (
          SELECT anonymized_ip, MIN(created_at) as first_time
          FROM ${tableRef}
          WHERE workspace_id = ${workspaceId} AND event_name = ${step1Event} AND created_at >= ${since}
          GROUP BY anonymized_ip
        ),
        step2 AS (
          SELECT e.anonymized_ip, MIN(e.created_at) as second_time
          FROM ${tableRef} e
          JOIN step1 s1 ON e.anonymized_ip = s1.anonymized_ip
          WHERE e.workspace_id = ${workspaceId} AND e.event_name = ${step2Event} AND e.created_at >= s1.first_time
          GROUP BY e.anonymized_ip
        ),
        step3 AS (
          SELECT e.anonymized_ip, MIN(e.created_at) as third_time
          FROM ${tableRef} e
          JOIN step2 s2 ON e.anonymized_ip = s2.anonymized_ip
          WHERE e.workspace_id = ${workspaceId} AND e.event_name = ${step3Event || ""} AND e.created_at >= s2.second_time
          GROUP BY e.anonymized_ip
        )
        SELECT
          (SELECT count(*) FROM step1)::int as step1,
          (SELECT count(*) FROM step2)::int as step2,
          ${step3Event ? sql`(SELECT count(*) FROM step3)::int` : sql`0::int`} as step3
      `;

      const { rows } = await tx.execute(funnelQuery);
      return rows[0];
    });

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : undefined;
    if (message === "Workspace not found") {
      res.status(404).json({ error: message });
      return;
    }
    if (code === "57014") {
      res.status(504).json({ error: "Query timed out. Upgrade tier for longer execution limits." });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/retention", async (req, res) => {
  const parsed = GetRetentionQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { workspaceId, days = 7 } = parsed.data;
  const since = toDayStart(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

  const retentionQuery = sql`
    WITH cohort AS (
      SELECT anonymized_ip, MIN(date) as cohort_date
      FROM daily_sessions_mv
      WHERE workspace_id = ${workspaceId} AND date >= ${since}
      GROUP BY anonymized_ip
    ),
    activity AS (
      SELECT anonymized_ip, date as activity_date
      FROM daily_sessions_mv
      WHERE workspace_id = ${workspaceId} AND date >= ${since}
      GROUP BY anonymized_ip, date
    ),
    retention AS (
      SELECT
        c.anonymized_ip,
        EXTRACT(DAY FROM (a.activity_date - c.cohort_date)) as day_diff
      FROM cohort c
      LEFT JOIN activity a ON c.anonymized_ip = a.anonymized_ip
    )
    SELECT
      COUNT(DISTINCT CASE WHEN day_diff = 0 THEN anonymized_ip END)::int as day0,
      COUNT(DISTINCT CASE WHEN day_diff = 1 THEN anonymized_ip END)::int as day1,
      COUNT(DISTINCT CASE WHEN day_diff = 7 THEN anonymized_ip END)::int as day7
    FROM retention
  `;

  const { rows } = await db.execute(retentionQuery);
  res.json(rows[0]);
});

export default router;
