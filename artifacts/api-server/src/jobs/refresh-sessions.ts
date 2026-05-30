import { refreshAnalyticsViews } from "../lib/refresh-analytics-views";
import { logger } from "../lib/logger";

async function main() {
  try {
    await refreshAnalyticsViews();
  } catch (err) {
    logger.error({ err }, "Failed to refresh analytics materialized views");
    process.exit(1);
  }
  process.exit(0);
}

import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { refreshAnalyticsViews };
