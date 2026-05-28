import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const segmentsTable = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  conditions: jsonb("conditions").notNull().$type<Array<{ field: string; op: string; value: string }>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Segment = typeof segmentsTable.$inferSelect;
