import { Router } from "express";
import { db, workspacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateWorkspaceBody,
  GetWorkspaceParams,
  DeleteWorkspaceParams,
} from "@workspace/api-zod";

const router = Router();

/**
 * @openapi
 * /api/workspaces:
 *   get:
 *     summary: List all workspaces
 *     description: Returns a list of all active workspaces, ordered by creation date.
 *     responses:
 *       200:
 *         description: List of workspaces.
 */
router.get("/workspaces", async (req, res) => {
  const workspaces = await db.select().from(workspacesTable).orderBy(workspacesTable.createdAt);
  res.json(workspaces.map(w => ({ ...w, createdAt: w.createdAt.toISOString() })));
});

/**
 * @openapi
 * /api/workspaces:
 *   post:
 *     summary: Create a new workspace
 *     description: Creates a new workspace with the given name and domain details.
 *     responses:
 *       201:
 *         description: Workspace successfully created.
 *       400:
 *         description: Validation error.
 */
router.post("/workspaces", async (req, res) => {
  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [workspace] = await db.insert(workspacesTable).values(parsed.data).returning();
  res.status(201).json({ ...workspace, createdAt: workspace.createdAt.toISOString() });
});

/**
 * @openapi
 * /api/workspaces/{workspaceId}:
 *   get:
 *     summary: Get workspace details
 *     description: Retrieve detailed metadata for a workspace by its unique ID.
 *     responses:
 *       200:
 *         description: Workspace metadata found.
 *       404:
 *         description: Workspace not found.
 */
router.get("/workspaces/:workspaceId", async (req, res) => {
  const parsed = GetWorkspaceParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, parsed.data.workspaceId));
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  res.json({ ...workspace, createdAt: workspace.createdAt.toISOString() });
});

/**
 * @openapi
 * /api/workspaces/{workspaceId}:
 *   delete:
 *     summary: Delete a workspace
 *     description: Deletes a workspace and all of its associated data (cascade).
 *     responses:
 *       204:
 *         description: Workspace successfully deleted.
 */
router.delete("/workspaces/:workspaceId", async (req, res) => {
  const parsed = DeleteWorkspaceParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.delete(workspacesTable).where(eq(workspacesTable.id, parsed.data.workspaceId));
  res.status(204).send();
});

export default router;

