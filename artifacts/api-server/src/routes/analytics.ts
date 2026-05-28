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
} from "@workspace/api-zod";
import { buildSegmentConditions } from "./segment-filter";

const router = Router();

async function resolveSegmentConditions(workspaceId: string, segmentId?: string): Promise<SQL[]> {
  if (!segmentId) return [];
  const [segment] = await db.select().from(segmentsTable)
    .where(and(eq(segmentsTable.id, segmentId), eq(segmentsTable.workspaceId, workspaceId)));
  if (!segment) return [];
  return buildSegmentConditions(segment.conditions);
}

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

export default router;
