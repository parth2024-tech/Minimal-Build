import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

/**
 * @openapi
 * /api/healthz:
 *   get:
 *     summary: Health status check
 *     description: Checks server health status and active database connectivity.
 *     responses:
 *       200:
 *         description: Server and database are healthy.
 *       500:
 *         description: Database connectivity check failed.
 */
router.get("/healthz", async (_req, res) => {
  try {
    // Perform a heartbeat query to verify live connection to PostgreSQL
    await db.execute(sql`SELECT 1`);
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ status: "error", error: "Database connection failed" });
  }
});

export default router;

