import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workspacesRouter from "./workspaces";
import apiKeysRouter from "./api-keys";
import eventsRouter from "./events";
import analyticsRouter from "./analytics";
import dashboardSummaryRouter from "./dashboard-summary";
import segmentsRouter from "./segments";
import exportRouter from "./export";
import auditRouter from "./audit";
import gdprRouter from "./gdpr";

/**
 * Main application router registration.
 * Orchestrates and mounts all API resource sub-routers.
 */
const router: IRouter = Router();


router.use(healthRouter);
router.use(workspacesRouter);
router.use(apiKeysRouter);
router.use(eventsRouter);
router.use(analyticsRouter);
router.use(dashboardSummaryRouter);
router.use(segmentsRouter);
router.use(exportRouter);
router.use(auditRouter);
router.use(gdprRouter);

export default router;
