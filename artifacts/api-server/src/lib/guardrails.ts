import { db, workspacesTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

/**
 * Wraps database operations in a transaction with strict statement timeouts
 * based on the workspace's pricing tier.
 * @param workspaceId The workspace ID
 * @param operation The database query logic to execute
 * @returns The result of the operation
 */
export async function withGuardrails<T>(
  workspaceId: string,
  operation: (tx: typeof db, isSampled: boolean) => Promise<T>
): Promise<T> {
  const [workspace] = await db
    .select({ tier: workspacesTable.tier })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));

  if (!workspace) throw new Error("Workspace not found");

  const isFree = workspace.tier === "free";
  
  // Drizzle transaction type generic is complex, we just cast tx to any internally 
  // or use tx as typeof db since it implements the same core methods.
  return await db.transaction(async (tx) => {
    // 5 seconds for free tier, 30 seconds for paid tier
    const timeoutMs = isFree ? 5000 : 30000;
    
    // Set timeout only for this specific transaction (LOCAL)
    await tx.execute(sql`SET LOCAL statement_timeout = ${timeoutMs}`);
    
    // We pass `tx as any` here because Drizzle's PgTransaction type is tricky to export/import cleanly
    // without deep type imports, but it exposes the same API as `db`.
    return await operation(tx as any, isFree);
  });
}
