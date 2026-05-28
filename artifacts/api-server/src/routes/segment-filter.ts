import { eventsTable } from "@workspace/db";
import { like, notLike, eq, ne, SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

type Condition = { field: string; op: string; value: string };

const fieldMap: Record<string, typeof eventsTable.url | typeof eventsTable.referrer | typeof eventsTable.eventName | typeof eventsTable.userAgent> = {
  url: eventsTable.url,
  referrer: eventsTable.referrer,
  event_name: eventsTable.eventName,
  user_agent: eventsTable.userAgent,
};

export function buildSegmentConditions(conditions: Condition[]): SQL[] {
  const result: SQL[] = [];
  for (const cond of conditions) {
    const col = fieldMap[cond.field];
    if (!col) continue;
    switch (cond.op) {
      case "contains":
        result.push(like(col as typeof eventsTable.url, `%${cond.value}%`));
        break;
      case "not_contains":
        result.push(notLike(col as typeof eventsTable.url, `%${cond.value}%`));
        break;
      case "equals":
        result.push(eq(col as typeof eventsTable.url, cond.value));
        break;
      case "not_equals":
        result.push(ne(col as typeof eventsTable.url, cond.value));
        break;
      case "starts_with":
        result.push(like(col as typeof eventsTable.url, `${cond.value}%`));
        break;
    }
  }
  return result;
}
