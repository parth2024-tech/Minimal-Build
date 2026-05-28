import { createHash } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "API key required. Pass Authorization: Bearer <key>" });
    return;
  }
  const rawKey = auth.slice(7).trim();
  if (!rawKey) {
    res.status(401).json({ error: "Empty API key" });
    return;
  }

  const workspaceId = (req.body as Record<string, unknown>)?.workspaceId;
  if (typeof workspaceId !== "string" || !workspaceId) {
    res.status(400).json({ error: "workspaceId is required in the request body" });
    return;
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const [key] = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, keyHash), eq(apiKeysTable.workspaceId, workspaceId)));

  if (!key) {
    res.status(401).json({ error: "Invalid or unauthorized API key" });
    return;
  }

  next();
}
