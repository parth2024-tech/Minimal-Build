import { Router } from "express";
import { db, workspacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateWorkspaceBody,
  GetWorkspaceParams,
  DeleteWorkspaceParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/workspaces", async (req, res) => {
  const workspaces = await db.select().from(workspacesTable).orderBy(workspacesTable.createdAt);
  res.json(workspaces.map(w => ({ ...w, createdAt: w.createdAt.toISOString() })));
});

router.post("/workspaces", async (req, res) => {
  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [workspace] = await db.insert(workspacesTable).values(parsed.data).returning();
  res.status(201).json({ ...workspace, createdAt: workspace.createdAt.toISOString() });
});

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
