import { Router } from "express";
import rateLimit from "express-rate-limit";
import { db, eventsTable, deadLetterEventsTable } from "@workspace/db";
import { IngestEventBody } from "@workspace/api-zod";
import { requireApiKey } from "../lib/api-key-auth";

const router = Router();

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Slow down and try again shortly." },
});

/**
 * Anonymizes an IP address to preserve user privacy (GDPR compliance).
 * Truncates IPv4 addresses to Class C subnet format.
 *
 * @param ip Raw client IP address string
 * @returns Anonymized IP string or null
 */
function anonymizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return null;
}

/**
 * @openapi
 * /api/v1/event:
 *   post:
 *     summary: Ingest an analytics event
 *     description: Ingests a new page view or custom user event from client tracking scripts.
 *     responses:
 *       201:
 *         description: Event recorded successfully.
 *       400:
 *         description: Invalid request payload.
 *       429:
 *         description: Too many requests (rate limit exceeded).
 */
router.post("/v1/event", ingestLimiter, requireApiKey, async (req, res) => {
  const parsed = IngestEventBody.safeParse(req.body);
  if (!parsed.success) {
    try {
      await db.insert(deadLetterEventsTable).values({
        workspaceId: typeof req.body?.workspaceId === "string" ? req.body.workspaceId : null,
        rawPayload: JSON.stringify(req.body),
        errorReason: JSON.stringify(parsed.error.flatten()),
      });
    } catch (err) {
      // Fail silently for DLQ insertions to avoid cascading errors
    }
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const rawIp =
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket.remoteAddress;
  const [event] = await db
    .insert(eventsTable)
    .values({
      workspaceId: parsed.data.workspaceId,
      eventName: parsed.data.eventName,
      url: parsed.data.url ?? null,
      referrer: parsed.data.referrer ?? null,
      anonymizedIp: anonymizeIp(rawIp),
      userAgent: parsed.data.userAgent ?? req.headers["user-agent"] ?? null,
      properties: (parsed.data.properties as Record<string, unknown>) ?? null,
    })
    .returning({ id: eventsTable.id });
  res.status(201).json({ id: String(event.id) });
});

export default router;

