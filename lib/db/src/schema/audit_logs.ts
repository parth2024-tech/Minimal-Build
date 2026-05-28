import { pgTable, text, timestamp, uuid, jsonb, bigserial } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const auditLogsTable = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  actor: text("actor").notNull().default("system"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
