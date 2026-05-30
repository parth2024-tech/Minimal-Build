import { pgMaterializedView } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { eventsTable } from "./events";

/** Daily page view counts — powers top-pages and unique-pages summary. */
export const dailyPageStatsMv = pgMaterializedView("daily_page_stats_mv").as((qb) =>
  qb
    .select({
      workspaceId: eventsTable.workspaceId,
      date: sql<Date>`date_trunc('day', ${eventsTable.createdAt})`.as("date"),
      url: eventsTable.url,
      eventCount: sql<number>`count(*)::int`.as("event_count"),
    })
    .from(eventsTable)
    .where(sql`${eventsTable.url} IS NOT NULL`)
    .groupBy(
      eventsTable.workspaceId,
      sql`date_trunc('day', ${eventsTable.createdAt})`,
      eventsTable.url,
    ),
);

/** Daily referrer counts — powers top-referrers. */
export const dailyReferrerStatsMv = pgMaterializedView("daily_referrer_stats_mv").as((qb) =>
  qb
    .select({
      workspaceId: eventsTable.workspaceId,
      date: sql<Date>`date_trunc('day', ${eventsTable.createdAt})`.as("date"),
      referrer: eventsTable.referrer,
      eventCount: sql<number>`count(*)::int`.as("event_count"),
    })
    .from(eventsTable)
    .where(sql`${eventsTable.referrer} IS NOT NULL`)
    .groupBy(
      eventsTable.workspaceId,
      sql`date_trunc('day', ${eventsTable.createdAt})`,
      eventsTable.referrer,
    ),
);

/** Daily event-name counts — powers timeseries event filter, top-event summary, event-names list. */
export const dailyEventStatsMv = pgMaterializedView("daily_event_stats_mv").as((qb) =>
  qb
    .select({
      workspaceId: eventsTable.workspaceId,
      date: sql<Date>`date_trunc('day', ${eventsTable.createdAt})`.as("date"),
      eventName: eventsTable.eventName,
      eventCount: sql<number>`count(*)::int`.as("event_count"),
    })
    .from(eventsTable)
    .groupBy(
      eventsTable.workspaceId,
      sql`date_trunc('day', ${eventsTable.createdAt})`,
      eventsTable.eventName,
    ),
);
