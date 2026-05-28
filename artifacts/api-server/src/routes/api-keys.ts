import { Router } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import {
  ListApiKeysParams,
  CreateApiKeyParams,
  CreateApiKeyBody,
  DeleteApiKeyParams,
} from "@workspace/api-zod";

const router = Router();

/**
 * @openapi
 * /api/workspaces/{workspaceId}/api-keys:
 *   get:
 *     summary: List API keys for a workspace
 *     description: Retrieve all API keys associated with a given workspace ID.
 *     responses:
 *       200:
 *         description: List of API keys.
 *       400:
 *         description: Validation error.
 */
router.get("/workspaces/:workspaceId/api-keys", async (req, res) => {
  const parsed = ListApiKeysParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const keys = await db.select().from(apiKeysTable)
    .where(eq(apiKeysTable.workspaceId, parsed.data.workspaceId))
    .orderBy(apiKeysTable.createdAt);
  res.json(keys.map(k => ({
    id: k.id,
    workspaceId: k.workspaceId,
    name: k.name,
    prefix: k.prefix,
    createdAt: k.createdAt.toISOString(),
  })));
});

/**
 * @openapi
 * /api/workspaces/{workspaceId}/api-keys:
 *   post:
 *     summary: Create a new API key
 *     description: Creates a cryptographically secure API key for the workspace.
 *     responses:
 *       201:
 *         description: Key created successfully. Includes secret token (only shown once).
 *       400:
 *         description: Validation error.
 */
router.post("/workspaces/:workspaceId/api-keys", async (req, res) => {
  const paramsParsed = CreateApiKeyParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }
  const bodyParsed = CreateApiKeyBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const secret = `pp_${crypto.randomBytes(24).toString("hex")}`;
  const prefix = secret.slice(0, 10);
  const keyHash = crypto.createHash("sha256").update(secret).digest("hex");
  const [key] = await db.insert(apiKeysTable).values({
    workspaceId: paramsParsed.data.workspaceId,
    name: bodyParsed.data.name,
    prefix,
    keyHash,
  }).returning();
  res.status(201).json({
    id: key.id,
    workspaceId: key.workspaceId,
    name: key.name,
    prefix: key.prefix,
    createdAt: key.createdAt.toISOString(),
    secret,
  });
});

/**
 * @openapi
 * /api/workspaces/{workspaceId}/api-keys/{keyId}:
 *   delete:
 *     summary: Delete an API key
 *     description: Revoke and permanently delete a workspace's API key.
 *     responses:
 *       204:
 *         description: API key successfully deleted.
 *       400:
 *         description: Validation error.
 */
router.delete("/workspaces/:workspaceId/api-keys/:keyId", async (req, res) => {
  const parsed = DeleteApiKeyParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.delete(apiKeysTable).where(
    and(
      eq(apiKeysTable.id, parsed.data.keyId),
      eq(apiKeysTable.workspaceId, parsed.data.workspaceId)
    )
  );
  res.status(204).send();
});

export default router;

