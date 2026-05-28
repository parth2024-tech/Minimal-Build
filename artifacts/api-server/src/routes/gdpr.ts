import { Router } from "express";
import { z } from "zod/v4";
import { db, eventsTable, auditLogsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { DeleteWorkspaceDataParams } from "@workspace/api-zod";

const router = Router();

const DeleteWorkspaceDataBody = z.object({
  olderThanDays: z.number().int().min(1).max(3650).optional(),
});

router.delete("/workspaces/:workspaceId/data", async (req, res) => {
  const paramsParsed = DeleteWorkspaceDataParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid workspace ID" });
    return;
  }

  const bodyParsed = DeleteWorkspaceDataBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "olderThanDays must be a positive integer up to 3650" });
    return;
  }

  const { workspaceId } = paramsParsed.data;
  const { olderThanDays } = bodyParsed.data;

  const conditions = [eq(eventsTable.workspaceId, workspaceId)];
  if (olderThanDays) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    conditions.push(lt(eventsTable.createdAt, cutoff));
  }

  const deleted = await db
    .delete(eventsTable)
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
