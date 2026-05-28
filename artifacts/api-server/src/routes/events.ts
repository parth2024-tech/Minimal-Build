import { Router } from "express";
import { db, eventsTable } from "@workspace/db";
import { IngestEventBody } from "@workspace/api-zod";

const router = Router();

function anonymizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return null;
}

router.post("/v1/event", async (req, res) => {
  const parsed = IngestEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rawIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress;
  const [event] = await db.insert(eventsTable).values({
    workspaceId: parsed.data.workspaceId,
    eventName: parsed.data.eventName,
    url: parsed.data.url ?? null,
    referrer: parsed.data.referrer ?? null,
    anonymizedIp: anonymizeIp(rawIp),
    userAgent: parsed.data.userAgent ?? req.headers["user-agent"] ?? null,
    properties: (parsed.data.properties as Record<string, unknown>) ?? null,
  }).returning({ id: eventsTable.id });
  res.status(201).json({ id: String(event.id) });
});

export default router;
