import { pgTable, text, timestamp, uuid, jsonb, bigserial, inet } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const eventsTable = pgTable("events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  eventName: text("event_name").notNull(),
  url: text("url"),
  referrer: text("referrer"),
  anonymizedIp: text("anonymized_ip"),
  userAgent: text("user_agent"),
  properties: jsonb("properties"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
