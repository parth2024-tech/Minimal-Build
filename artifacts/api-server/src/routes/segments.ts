import { Router } from "express";
import { db, segmentsTable, auditLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListSegmentsParams,
  CreateSegmentParams,
  CreateSegmentBody,
  DeleteSegmentParams,
} from "@workspace/api-zod";

const router = Router();

/**
 * @openapi
 * /api/workspaces/{workspaceId}/segments:
 *   get:
 *     summary: List saved segments
 *     description: Retrieve all cohort segments configured for a workspace.
 *     responses:
 *       200:
 *         description: Array of saved segment objects.
 *       400:
 *         description: Validation error.
 */
router.get("/workspaces/:workspaceId/segments", async (req, res) => {
  const parsed = ListSegmentsParams.safeParse(req.params);

  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const rows = await db.select().from(segmentsTable)
    .where(eq(segmentsTable.workspaceId, parsed.data.workspaceId))
    .orderBy(segmentsTable.createdAt);

  res.json(rows.map(s => ({ ...s, createdAt: s.createdAt.toISOString() })));
});

router.post("/workspaces/:workspaceId/segments", async (req, res) => {
  const paramsParsed = CreateSegmentParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = CreateSegmentBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const [segment] = await db.insert(segmentsTable).values({
    workspaceId: paramsParsed.data.workspaceId,
    name: bodyParsed.data.name,
    conditions: bodyParsed.data.conditions,
  }).returning();

  await db.insert(auditLogsTable).values({
    workspaceId: paramsParsed.data.workspaceId,
    action: "segment.created",
    actor: "user",
    meta: { segmentId: segment.id, name: segment.name },
  });

  res.status(201).json({ ...segment, createdAt: segment.createdAt.toISOString() });
});

router.delete("/workspaces/:workspaceId/segments/:segmentId", async (req, res) => {
  const parsed = DeleteSegmentParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.delete(segmentsTable).where(
    and(
      eq(segmentsTable.id, parsed.data.segmentId),
      eq(segmentsTable.workspaceId, parsed.data.workspaceId)
    )
  );

  await db.insert(auditLogsTable).values({
    workspaceId: parsed.data.workspaceId,
    action: "segment.deleted",
    actor: "user",
    meta: { segmentId: parsed.data.segmentId },
  });

  res.status(204).send();
});

export default router;
