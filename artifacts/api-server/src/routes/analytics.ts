import { Router } from "express";
import { db, eventsTable, segmentsTable } from "@workspace/db";
import { sql, gte, and, eq, isNotNull, SQL } from "drizzle-orm";
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
import { buildSegmentConditions } from "./segment-filter";
import { withGuardrails } from "../lib/guardrails";

const router = Router();

/**
 * Resolves database segment where-conditions based on stored segment parameters.
 *
 * @param workspaceId Workspace unique identifier
 * @param segmentId Cohort Segment unique identifier
 * @returns Array of compiled Drizzle SQL expressions
 */
async function resolveSegmentConditions(workspaceId: string, segmentId?: string): Promise<SQL[]> {
  if (!segmentId) return [];
  const [segment] = await db.select().from(segmentsTable)
    .where(and(eq(segmentsTable.id, segmentId), eq(segmentsTable.workspaceId, workspaceId)));
  if (!segment) return [];
  return buildSegmentConditions(segment.conditions);
}

/**
 * @openapi
 * /api/analytics/summary:
 *   get:
 *     summary: Retrieve analytics summary
 *     description: Retrieve total events, unique page counts, top events, and change percentages for a workspace.
 *     responses:
 *       200:
 *         description: Consolidated analytics overview metrics.
 *       400:
 *         description: Validation error.
 */
router.get("/analytics/summary", async (req, res) => {

  const parsed = GetAnalyticsSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId, days = 7, segmentId } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000);
  const segConds = await resolveSegmentConditions(workspaceId, segmentId ?? undefined);

  const [current] = await db.select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since), ...segConds));

  const [previous] = await db.select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(
      eq(eventsTable.workspaceId, workspaceId),
      gte(eventsTable.createdAt, prevSince),
      sql`${eventsTable.createdAt} < ${since}`,
      ...segConds
    ));

  const uniquePages = await db.selectDistinct({ url: eventsTable.url })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since), isNotNull(eventsTable.url), ...segConds));

  const topEvents = await db.select({
    eventName: eventsTable.eventName,
    count: sql<number>`count(*)::int`,
  })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since), ...segConds))
    .groupBy(eventsTable.eventName)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  const prevCount = previous.count || 0;
  const curCount = current.count || 0;
  const changePercent = prevCount === 0 ? 0 : ((curCount - prevCount) / prevCount) * 100;
  const avgEventsPerDay = days > 0 ? Math.round((curCount / days) * 10) / 10 : 0;

  res.json({
    totalEvents: curCount,
    uniquePages: uniquePages.length,
    topEventName: topEvents[0]?.eventName ?? null,
    changePercent: Math.round(changePercent * 10) / 10,
    avgEventsPerDay,
  });
});

router.get("/analytics/timeseries", async (req, res) => {
  const parsed = GetTimeseriesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId, days = 7, eventName, segmentId } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const segConds = await resolveSegmentConditions(workspaceId, segmentId ?? undefined);

  const conditions: SQL[] = [
    eq(eventsTable.workspaceId, workspaceId),
    gte(eventsTable.createdAt, since),
    ...segConds,
  ];
  if (eventName) conditions.push(eq(eventsTable.eventName, eventName));

  const rows = await db.select({
    date: sql<string>`date_trunc('day', ${eventsTable.createdAt})::date::text`,
    count: sql<number>`count(*)::int`,
  })
    .from(eventsTable)
    .where(and(...conditions))
    .groupBy(sql`date_trunc('day', ${eventsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${eventsTable.createdAt})`);

  res.json(rows);
});

router.get("/analytics/top-pages", async (req, res) => {
  const parsed = GetTopPagesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId, days = 7, limit = 10, segmentId } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const segConds = await resolveSegmentConditions(workspaceId, segmentId ?? undefined);

  const rows = await db.select({
    url: eventsTable.url,
    count: sql<number>`count(*)::int`,
  })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since), isNotNull(eventsTable.url), ...segConds))
    .groupBy(eventsTable.url)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  res.json(rows.map(r => ({ url: r.url!, count: r.count })));
});

router.get("/analytics/top-referrers", async (req, res) => {
  const parsed = GetTopReferrersQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId, days = 7, limit = 10, segmentId } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const segConds = await resolveSegmentConditions(workspaceId, segmentId ?? undefined);

  const rows = await db.select({
    referrer: eventsTable.referrer,
    count: sql<number>`count(*)::int`,
  })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since), isNotNull(eventsTable.referrer), ...segConds))
    .groupBy(eventsTable.referrer)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  res.json(rows.map(r => ({ referrer: r.referrer!, count: r.count })));
});

router.get("/analytics/event-names", async (req, res) => {
  const parsed = GetEventNamesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const rows = await db.selectDistinct({ eventName: eventsTable.eventName })
    .from(eventsTable)
    .where(eq(eventsTable.workspaceId, parsed.data.workspaceId))
    .orderBy(eventsTable.eventName);

  res.json(rows.map(r => r.eventName));
});

router.get("/analytics/live", async (req, res) => {
  const parsed = GetLiveStatsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId } = parsed.data;
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const oneMinAgo = new Date(Date.now() - 60 * 1000);

  const [five] = await db.select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, fiveMinAgo)));

  const [one] = await db.select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, oneMinAgo)));

  res.json({ eventsLast5Min: five.count, eventsLast1Min: one.count });
});

router.get("/analytics/funnel", async (req, res) => {
  const parsed = GetFunnelQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId, step1Event, step2Event, step3Event, days = 7 } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const result = await withGuardrails(workspaceId, async (tx, isSampled) => {
      // Dynamic table reference to support TABLESAMPLE for free-tier users
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
          WHERE e.workspace_id = ${workspaceId} AND e.event_name = ${step3Event || ''} AND e.created_at >= s2.second_time
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
  } catch (err: any) {
    if (err.message === "Workspace not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    // Forward statement_timeout errors as 504
    if (err.code === '57014') { // query_canceled
      res.status(504).json({ error: "Query timed out. Upgrade tier for longer execution limits." });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/retention", async (req, res) => {
  const parsed = GetRetentionQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId, days = 7 } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const retentionQuery = sql`
    WITH cohort AS (
      SELECT anonymized_ip, DATE_TRUNC('day', MIN(created_at)) as cohort_date
      FROM events
      WHERE workspace_id = ${workspaceId} AND created_at >= ${since}
      GROUP BY anonymized_ip
    ),
    activity AS (
      SELECT e.anonymized_ip, DATE_TRUNC('day', e.created_at) as activity_date
      FROM events e
      WHERE e.workspace_id = ${workspaceId} AND e.created_at >= ${since}
      GROUP BY e.anonymized_ip, DATE_TRUNC('day', e.created_at)
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
