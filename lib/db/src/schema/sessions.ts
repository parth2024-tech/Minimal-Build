import { pgMaterializedView } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { eventsTable } from "./events";

export const dailySessionsMv = pgMaterializedView("daily_sessions_mv").as((qb) =>
  qb
    .select({
      sessionHash: sql<string>`md5(concat(${eventsTable.workspaceId}, ${eventsTable.anonymizedIp}, ${eventsTable.userAgent}, date_trunc('day', ${eventsTable.createdAt})))`.as("session_hash"),
      workspaceId: eventsTable.workspaceId,
      date: sql<Date>`date_trunc('day', ${eventsTable.createdAt})`.as("date"),
      anonymizedIp: eventsTable.anonymizedIp,
      userAgent: eventsTable.userAgent,
      startTime: sql<Date>`min(${eventsTable.createdAt})`.as("start_time"),
      endTime: sql<Date>`max(${eventsTable.createdAt})`.as("end_time"),
      eventCount: sql<number>`count(*)::int`.as("event_count"),
    })
    .from(eventsTable)
    .groupBy(
      eventsTable.workspaceId,
      eventsTable.anonymizedIp,
      eventsTable.userAgent,
      sql`date_trunc('day', ${eventsTable.createdAt})`
    )
);
