import {
  db,
  eventsTable,
  segmentsTable,
  dailySessionsMv,
  dailyPageStatsMv,
  dailyReferrerStatsMv,
  dailyEventStatsMv,
} from "@workspace/db";
import { sql, gte, and, eq, isNotNull, lt, SQL } from "drizzle-orm";
import { buildSegmentConditions } from "../routes/segment-filter";
import {
  buildSessionMvSegmentConditions,
  segmentNeedsRawEvents,
  toDayStart,
} from "./analytics-source";

export type SegmentCondition = { field: string; op: string; value: string };

export type SegmentContext = {
  rawConds: SQL[];
  mvConds: SQL[];
  conditions: SegmentCondition[];
};

export type AnalyticsSummaryResult = {
  totalEvents: number;
  uniquePages: number;
  topEventName: string | null;
  changePercent: number;
  avgEventsPerDay: number;
};

export type TimeseriesPoint = { date: string; count: number };
export type TopPageRow = { url: string; count: number };
export type TopReferrerRow = { referrer: string; count: number };
export type LiveStatsResult = { eventsLast5Min: number; eventsLast1Min: number };
export type SegmentRow = {
  id: string;
  workspaceId: string;
  name: string;
  conditions: unknown;
  createdAt: string;
};

export async function getSegmentContext(
  workspaceId: string,
  segmentId?: string,
): Promise<SegmentContext> {
  if (!segmentId) {
    return { rawConds: [], mvConds: [], conditions: [] };
  }
  const [segment] = await db
    .select()
    .from(segmentsTable)
    .where(and(eq(segmentsTable.id, segmentId), eq(segmentsTable.workspaceId, workspaceId)));
  if (!segment) {
    return { rawConds: [], mvConds: [], conditions: [] };
  }
  const conditions = segment.conditions as SegmentCondition[];
  return {
    conditions,
    rawConds: buildSegmentConditions(conditions),
    mvConds: buildSessionMvSegmentConditions(conditions),
  };
}

export async function fetchAnalyticsSummary(
  workspaceId: string,
  days: number,
  segment: SegmentContext,
): Promise<AnalyticsSummaryResult> {
  const since = toDayStart(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const prevSince = toDayStart(new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000));
  const useMv = !segmentNeedsRawEvents(segment.conditions);

  if (useMv) {
    const [current] = await db
      .select({ count: sql<number>`coalesce(sum(${dailySessionsMv.eventCount}), 0)::int` })
      .from(dailySessionsMv)
      .where(
        and(eq(dailySessionsMv.workspaceId, workspaceId), gte(dailySessionsMv.date, since), ...segment.mvConds),
      );

    const [previous] = await db
      .select({ count: sql<number>`coalesce(sum(${dailySessionsMv.eventCount}), 0)::int` })
      .from(dailySessionsMv)
      .where(
        and(
          eq(dailySessionsMv.workspaceId, workspaceId),
          gte(dailySessionsMv.date, prevSince),
          lt(dailySessionsMv.date, since),
          ...segment.mvConds,
        ),
      );

    const [uniquePagesRow] = await db
      .select({ count: sql<number>`count(distinct ${dailyPageStatsMv.url})::int` })
      .from(dailyPageStatsMv)
      .where(and(eq(dailyPageStatsMv.workspaceId, workspaceId), gte(dailyPageStatsMv.date, since)));

    const topEvents = await db
      .select({
        eventName: dailyEventStatsMv.eventName,
        count: sql<number>`sum(${dailyEventStatsMv.eventCount})::int`,
      })
      .from(dailyEventStatsMv)
      .where(and(eq(dailyEventStatsMv.workspaceId, workspaceId), gte(dailyEventStatsMv.date, since)))
      .groupBy(dailyEventStatsMv.eventName)
      .orderBy(sql`sum(${dailyEventStatsMv.eventCount}) desc`)
      .limit(1);

    const prevCount = previous?.count ?? 0;
    const curCount = current?.count ?? 0;
    const changePercent = prevCount === 0 ? 0 : ((curCount - prevCount) / prevCount) * 100;

    return {
      totalEvents: curCount,
      uniquePages: uniquePagesRow?.count ?? 0,
      topEventName: topEvents[0]?.eventName ?? null,
      changePercent: Math.round(changePercent * 10) / 10,
      avgEventsPerDay: days > 0 ? Math.round((curCount / days) * 10) / 10 : 0,
    };
  }

  const [current] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since), ...segment.rawConds));

  const [previous] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.workspaceId, workspaceId),
        gte(eventsTable.createdAt, prevSince),
        sql`${eventsTable.createdAt} < ${since}`,
        ...segment.rawConds,
      ),
    );

  const uniquePages = await db
    .selectDistinct({ url: eventsTable.url })
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.workspaceId, workspaceId),
        gte(eventsTable.createdAt, since),
        isNotNull(eventsTable.url),
        ...segment.rawConds,
      ),
    );

  const topEvents = await db
    .select({
      eventName: eventsTable.eventName,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, since), ...segment.rawConds))
    .groupBy(eventsTable.eventName)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  const prevCount = previous?.count ?? 0;
  const curCount = current?.count ?? 0;
  const changePercent = prevCount === 0 ? 0 : ((curCount - prevCount) / prevCount) * 100;

  return {
    totalEvents: curCount,
    uniquePages: uniquePages.length,
    topEventName: topEvents[0]?.eventName ?? null,
    changePercent: Math.round(changePercent * 10) / 10,
    avgEventsPerDay: days > 0 ? Math.round((curCount / days) * 10) / 10 : 0,
  };
}

export async function fetchTimeseries(
  workspaceId: string,
  days: number,
  eventName: string | undefined,
  segment: SegmentContext,
): Promise<TimeseriesPoint[]> {
  const since = toDayStart(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const useMv = !segmentNeedsRawEvents(segment.conditions);

  if (useMv && !eventName) {
    return db
      .select({
        date: sql<string>`${dailySessionsMv.date}::date::text`,
        count: sql<number>`coalesce(sum(${dailySessionsMv.eventCount}), 0)::int`,
      })
      .from(dailySessionsMv)
      .where(
        and(eq(dailySessionsMv.workspaceId, workspaceId), gte(dailySessionsMv.date, since), ...segment.mvConds),
      )
      .groupBy(dailySessionsMv.date)
      .orderBy(dailySessionsMv.date);
  }

  if (useMv && eventName) {
    return db
      .select({
        date: sql<string>`${dailyEventStatsMv.date}::date::text`,
        count: sql<number>`coalesce(sum(${dailyEventStatsMv.eventCount}), 0)::int`,
      })
      .from(dailyEventStatsMv)
      .where(
        and(
          eq(dailyEventStatsMv.workspaceId, workspaceId),
          gte(dailyEventStatsMv.date, since),
          eq(dailyEventStatsMv.eventName, eventName),
        ),
      )
      .groupBy(dailyEventStatsMv.date)
      .orderBy(dailyEventStatsMv.date);
  }

  const whereClauses: SQL[] = [
    eq(eventsTable.workspaceId, workspaceId),
    gte(eventsTable.createdAt, since),
    ...segment.rawConds,
  ];
  if (eventName) whereClauses.push(eq(eventsTable.eventName, eventName));

  return db
    .select({
      date: sql<string>`date_trunc('day', ${eventsTable.createdAt})::date::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(and(...whereClauses))
    .groupBy(sql`date_trunc('day', ${eventsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${eventsTable.createdAt})`);
}

export async function fetchTopPages(
  workspaceId: string,
  days: number,
  limit: number,
  segment: SegmentContext,
): Promise<TopPageRow[]> {
  const since = toDayStart(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

  if (!segmentNeedsRawEvents(segment.conditions)) {
    const rows = await db
      .select({
        url: dailyPageStatsMv.url,
        count: sql<number>`sum(${dailyPageStatsMv.eventCount})::int`,
      })
      .from(dailyPageStatsMv)
      .where(and(eq(dailyPageStatsMv.workspaceId, workspaceId), gte(dailyPageStatsMv.date, since)))
      .groupBy(dailyPageStatsMv.url)
      .orderBy(sql`sum(${dailyPageStatsMv.eventCount}) desc`)
      .limit(limit);
    return rows.map((r) => ({ url: r.url!, count: r.count }));
  }

  const rows = await db
    .select({
      url: eventsTable.url,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.workspaceId, workspaceId),
        gte(eventsTable.createdAt, since),
        isNotNull(eventsTable.url),
        ...segment.rawConds,
      ),
    )
    .groupBy(eventsTable.url)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((r) => ({ url: r.url!, count: r.count }));
}

export async function fetchTopReferrers(
  workspaceId: string,
  days: number,
  limit: number,
  segment: SegmentContext,
): Promise<TopReferrerRow[]> {
  const since = toDayStart(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

  if (!segmentNeedsRawEvents(segment.conditions)) {
    const rows = await db
      .select({
        referrer: dailyReferrerStatsMv.referrer,
        count: sql<number>`sum(${dailyReferrerStatsMv.eventCount})::int`,
      })
      .from(dailyReferrerStatsMv)
      .where(and(eq(dailyReferrerStatsMv.workspaceId, workspaceId), gte(dailyReferrerStatsMv.date, since)))
      .groupBy(dailyReferrerStatsMv.referrer)
      .orderBy(sql`sum(${dailyReferrerStatsMv.eventCount}) desc`)
      .limit(limit);
    return rows.map((r) => ({ referrer: r.referrer!, count: r.count }));
  }

  const rows = await db
    .select({
      referrer: eventsTable.referrer,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.workspaceId, workspaceId),
        gte(eventsTable.createdAt, since),
        isNotNull(eventsTable.referrer),
        ...segment.rawConds,
      ),
    )
    .groupBy(eventsTable.referrer)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((r) => ({ referrer: r.referrer!, count: r.count }));
}

export async function fetchEventNames(workspaceId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ eventName: dailyEventStatsMv.eventName })
    .from(dailyEventStatsMv)
    .where(eq(dailyEventStatsMv.workspaceId, workspaceId))
    .orderBy(dailyEventStatsMv.eventName);

  return rows.map((r) => r.eventName);
}

export async function fetchLiveStats(workspaceId: string): Promise<LiveStatsResult> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const oneMinAgo = new Date(Date.now() - 60 * 1000);

  const [five] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, fiveMinAgo)));

  const [one] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(eq(eventsTable.workspaceId, workspaceId), gte(eventsTable.createdAt, oneMinAgo)));

  return { eventsLast5Min: five.count, eventsLast1Min: one.count };
}

export async function fetchWorkspaceSegments(workspaceId: string): Promise<SegmentRow[]> {
  const rows = await db
    .select()
    .from(segmentsTable)
    .where(eq(segmentsTable.workspaceId, workspaceId))
    .orderBy(segmentsTable.createdAt);

  return rows.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));
}
