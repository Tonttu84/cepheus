import type { DbContext } from "./context";

const lockedInTx = new WeakMap<object, Set<string>>();

/**
 * Acquires a row-level lock on the Participant row (`FOR UPDATE`) if currently
 * inside a unit of work. Idempotent per transaction to avoid duplicate queries.
 */
export async function lockParticipant(ctx: DbContext, patientId: string): Promise<void> {
  if (!ctx.isInUnitOfWork()) return;
  const client = ctx.client();
  let set = lockedInTx.get(client);
  if (set?.has(patientId)) return;

  await client.$queryRaw`SELECT "id" FROM "Participant" WHERE "id" = ${patientId} FOR UPDATE`;
  if (!set) {
    set = new Set<string>();
    lockedInTx.set(client, set);
  }
  set.add(patientId);
}
