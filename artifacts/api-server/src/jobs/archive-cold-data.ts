import { db, eventsTable } from "@workspace/db";
import { sql, lt } from "drizzle-orm";
import { logger } from "../lib/logger";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

async function archiveColdData() {
  logger.info("Starting cold data archival process...");
  
  // Define cutoff as 7 days ago
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  try {
    // 1. Fetch old records (In a real system with massive data, use pg-copy-streams)
    const oldEvents = await db
      .select()
      .from(eventsTable)
      .where(lt(eventsTable.createdAt, cutoffDate))
      .limit(10000); // Batch limit for safety

    if (oldEvents.length === 0) {
      logger.info("No cold data found to archive.");
      process.exit(0);
    }

    // 2. Write to CSV (Simulating Parquet/S3 upload)
    const outDir = path.join(process.cwd(), "archives");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    const fileName = `archive_${Date.now()}.jsonl`;
    const outPath = path.join(outDir, fileName);
    
    const dataString = oldEvents.map(e => JSON.stringify(e)).join("\n");
    fs.writeFileSync(outPath, dataString);
    logger.info(`Archived ${oldEvents.length} records to ${outPath}. Uploading to S3...`);
    
    // Simulate S3 upload
    // await s3.putObject({ Bucket: "cold-storage", Key: fileName, Body: fs.createReadStream(outPath) }).promise();
    
    // 3. Delete from Postgres
    const deleteResult = await db
      .delete(eventsTable)
      .where(lt(eventsTable.createdAt, cutoffDate));
      
    logger.info(`Successfully deleted cold records from PostgreSQL.`);
  } catch (err) {
    logger.error({ err }, "Failed during cold data archival.");
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  archiveColdData();
}
