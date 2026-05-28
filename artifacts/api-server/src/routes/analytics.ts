import { Router } from "express";
import { db, eventsTable } from "@workspace/db";
import { sql, gte, and, eq, isNotNull } from "drizzle-orm";
import {
  GetAnalyticsSummaryQueryParams,
  GetTimeseriesQueryParams,
  GetTopPagesQueryParams,
  GetTopReferrersQueryParams,
  GetEventNamesQueryParams,
  GetLiveStatsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/analytics/summary", async (req, res) => {
  const parsed = GetAnalyticsSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { workspaceId, days = 7 } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000);

  const [current] = await db.select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since)));

  const [previous] = await db.select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(
      eq(eventsTable.workspaceId, workspaceId),
      gte(eventsTable.createdAt, prevSince),
      sql`${eventsTable.createdAt} < ${since}`
    ));

  const uniquePages = await db.selectDistinct({ url: eventsTable.url })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since), isNotNull(eventsTable.url)));

  const topEvents = await db.select({
    eventName: eventsTable.eventName,
    count: sql<number>`count(*)::int`,
  })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since)))
    .groupBy(eventsTable.eventName)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  const prevCount = previous.count || 0;
  const curCount = current.count || 0;
  const changePercent = prevCount === 0 ? 0 : ((curCount - prevCount) / prevCount) * 100;

  res.json({
    totalEvents: curCount,
    uniquePages: uniquePages.length,
    topEventName: topEvents[0]?.eventName ?? null,
    changePercent: Math.round(changePercent * 10) / 10,
  });
});

router.get("/analytics/timeseries", async (req, res) => {
  const parsed = GetTimeseriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { workspaceId, days = 7, eventName } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const conditions = [
    eq(eventsTable.workspaceId, workspaceId),
    gte(eventsTable.createdAt, since),
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
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { workspaceId, days = 7, limit = 10 } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db.select({
    url: eventsTable.url,
    count: sql<number>`count(*)::int`,
  })
    .from(eventsTable)
    .where(and(
      eq(eventsTable.workspaceId, workspaceId),
      gte(eventsTable.createdAt, since),
      isNotNull(eventsTable.url)
    ))
    .groupBy(eventsTable.url)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  res.json(rows.map(r => ({ url: r.url!, count: r.count })));
});

router.get("/analytics/top-referrers", async (req, res) => {
  const parsed = GetTopReferrersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { workspaceId, days = 7, limit = 10 } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db.select({
    referrer: eventsTable.referrer,
    count: sql<number>`count(*)::int`,
  })
    .from(eventsTable)
    .where(and(
      eq(eventsTable.workspaceId, workspaceId),
      gte(eventsTable.createdAt, since),
      isNotNull(eventsTable.referrer)
    ))
    .groupBy(eventsTable.referrer)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  res.json(rows.map(r => ({ referrer: r.referrer!, count: r.count })));
});

router.get("/analytics/event-names", async (req, res) => {
  const parsed = GetEventNamesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { workspaceId } = parsed.data;

  const rows = await db.selectDistinct({ eventName: eventsTable.eventName })
    .from(eventsTable)
    .where(eq(eventsTable.workspaceId, workspaceId))
    .orderBy(eventsTable.eventName);

  res.json(rows.map(r => r.eventName));
});

router.get("/analytics/live", async (req, res) => {
  const parsed = GetLiveStatsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
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
