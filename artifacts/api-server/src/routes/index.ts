import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workspacesRouter from "./workspaces";
import apiKeysRouter from "./api-keys";
import eventsRouter from "./events";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspacesRouter);
router.use(apiKeysRouter);
router.use(eventsRouter);
router.use(analyticsRouter);

export default router;
