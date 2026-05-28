import { Router } from "express";
import { db, eventsTable, segmentsTable } from "@workspace/db";
import { eq, gte, and, isNotNull, SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { ExportEventsQueryParams } from "@workspace/api-zod";
import { buildSegmentConditions } from "./segment-filter";

const router = Router();

router.get("/analytics/export", async (req, res) => {
  const parsed = ExportEventsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId, days = 7, eventName, segmentId } = parsed.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const conditions: SQL[] = [
    eq(eventsTable.workspaceId, workspaceId),
    gte(eventsTable.createdAt, since),
  ];
  if (eventName) conditions.push(eq(eventsTable.eventName, eventName));

  if (segmentId) {
    const [segment] = await db.select().from(segmentsTable)
      .where(and(eq(segmentsTable.id, segmentId), eq(segmentsTable.workspaceId, workspaceId)));
    if (segment) {
      const extra = buildSegmentConditions(segment.conditions);
      conditions.push(...extra);
    }
  }

  const rows = await db.select({
    id: eventsTable.id,
    eventName: eventsTable.eventName,
    url: eventsTable.url,
    referrer: eventsTable.referrer,
    anonymizedIp: eventsTable.anonymizedIp,
    userAgent: eventsTable.userAgent,
    createdAt: eventsTable.createdAt,
  })
    .from(eventsTable)
    .where(and(...conditions))
    .orderBy(eventsTable.createdAt)
    .limit(10000);

  const header = "id,event_name,url,referrer,anonymized_ip,user_agent,created_at\n";
  const csvRows = rows.map(r => [
    r.id,
    csvEscape(r.eventName),
    csvEscape(r.url ?? ""),
    csvEscape(r.referrer ?? ""),
    csvEscape(r.anonymizedIp ?? ""),
    csvEscape(r.userAgent ?? ""),
    r.createdAt.toISOString(),
  ].join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="events-${workspaceId}-${days}d.csv"`);
  res.send(header + csvRows);
});

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export default router;
