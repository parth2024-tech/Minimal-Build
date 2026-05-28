import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";

const router = Router();

/**
 * @openapi
 * /api/analytics/audit-logs:
 *   get:
 *     summary: Retrieve workspace audit logs
 *     description: Retrieve audit logs detailing administrative changes in the workspace.
 *     responses:
 *       200:
 *         description: List of audit log actions.
 *       400:
 *         description: Validation error.
 */
router.get("/analytics/audit-logs", async (req, res) => {
  const parsed = ListAuditLogsQueryParams.safeParse(req.query);

  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId, limit = 50 } = parsed.data;

  const rows = await db.select().from(auditLogsTable)
    .where(eq(auditLogsTable.workspaceId, workspaceId))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit);

  res.json(rows.map(r => ({
    id: String(r.id),
    workspaceId: r.workspaceId,
    action: r.action,
    actor: r.actor,
    meta: r.meta,
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
