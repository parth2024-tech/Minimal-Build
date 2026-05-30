import type { SQL } from "drizzle-orm";
import { dailySessionsMv } from "@workspace/db";
import { like, notLike, eq, ne } from "drizzle-orm";

type SegmentCondition = { field: string; op: string; value: string };

/** Segment fields that require scanning the raw events table. */
const RAW_EVENT_FIELDS = new Set(["url", "referrer", "event_name"]);

export function segmentNeedsRawEvents(conditions: SegmentCondition[]): boolean {
  return conditions.some((c) => RAW_EVENT_FIELDS.has(c.field));
}

function escapeLike(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** user_agent filters applicable to daily_sessions_mv. */
export function buildSessionMvSegmentConditions(conditions: SegmentCondition[]): SQL[] {
  const result: SQL[] = [];
  for (const cond of conditions) {
    if (cond.field !== "user_agent") continue;
    const col = dailySessionsMv.userAgent;
    const safe = escapeLike(cond.value);
    switch (cond.op) {
      case "contains":
        result.push(like(col, `%${safe}%`));
        break;
      case "not_contains":
        result.push(notLike(col, `%${safe}%`));
        break;
      case "equals":
        result.push(eq(col, cond.value));
        break;
      case "not_equals":
        result.push(ne(col, cond.value));
        break;
      case "starts_with":
        result.push(like(col, `${safe}%`));
        break;
    }
  }
  return result;
}

/** Truncate to start-of-day for MV date column comparisons. */
export function toDayStart(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}
