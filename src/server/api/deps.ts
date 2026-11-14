import { getPrisma } from "@/lib/db";
import { createPrismaPorts } from "@/server/db";
import type { Ports } from "@/usecases/ports";

export interface RouteDeps {
  readonly ports: Ports;
  /** The ids of every patient of one clinic; the ports have no such listing. */
  readonly clinicPatientIds: (clinicId: string) => Promise<readonly string[]>;
}

async function clinicPatientIdsFromDb(clinicId: string): Promise<readonly string[]> {
  const rows = await getPrisma().participant.findMany({
    where: { clinicId },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return rows.map((row) => row.id);
}

function createDefaultDeps(): RouteDeps {
  return { ports: createPrismaPorts(), clinicPatientIds: clinicPatientIdsFromDb };
}

let factory: () => RouteDeps = createDefaultDeps;

/** The storage the routes use: PostgreSQL, or what a test put in its place. */
export function getRouteDeps(): RouteDeps {
  return factory();
}

export function setRouteDepsForTests(next: () => RouteDeps): void {
  factory = next;
}

export function resetRouteDeps(): void {
  factory = createDefaultDeps;
}
