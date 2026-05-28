import { Router } from "express";
import { db, eventsTable, auditLogsTable } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { DeleteWorkspaceDataParams } from "@workspace/api-zod";

const router = Router();

router.delete("/workspaces/:workspaceId/data", async (req, res) => {
  const parsed = DeleteWorkspaceDataParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workspaceId } = parsed.data;
  const body = req.body as { olderThanDays?: number } | undefined;
  const olderThanDays = body?.olderThanDays;

  const conditions = [eq(eventsTable.workspaceId, workspaceId)];
  if (olderThanDays && olderThanDays > 0) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    conditions.push(lt(eventsTable.createdAt, cutoff));
  }

  const deleted = await db.delete(eventsTable)
    .where(and(...conditions))
    .returning({ id: eventsTable.id });

  await db.insert(auditLogsTable).values({
    workspaceId,
    action: "data.deleted",
    actor: "user",
    meta: { deletedCount: deleted.length, olderThanDays: olderThanDays ?? null },
  });

  res.json({ deletedCount: deleted.length });
});

export default router;
