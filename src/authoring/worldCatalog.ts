import type { CellComplexSpec } from "../cell-complex/specs";
import { cube, dodecahedron, icosahedron, octahedron, tetrahedron, torus } from "./exampleWorlds";

export interface WorldCatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly loadSpec: () => Promise<CellComplexSpec>;
}

interface WorldCatalogRecord extends WorldCatalogEntry {
  readonly spec: CellComplexSpec;
}

const worldCatalogRecords = [
  createWorldCatalogRecord("cube", "Cube", cube),
  createWorldCatalogRecord("dodecahedron", "Dodecahedron", dodecahedron),
  createWorldCatalogRecord("icosahedron", "Icosahedron", icosahedron),
  createWorldCatalogRecord("octahedron", "Octahedron", octahedron),
  createWorldCatalogRecord("tetrahedron", "Tetrahedron", tetrahedron),
  createWorldCatalogRecord("torus", "Torus", torus),
] as const satisfies readonly WorldCatalogRecord[];

export const defaultWorldId = "cube";

export const worldCatalog: readonly WorldCatalogEntry[] = [...worldCatalogRecords]
  .sort((a, b) => a.label.localeCompare(b.label))
  .map(({ spec, ...entry }) => entry);

export const starterWorldSpecs: readonly CellComplexSpec[] = worldCatalogRecords.map((entry) => entry.spec);

export async function loadWorldSpec(worldId: string): Promise<CellComplexSpec> {
  const selectedWorld = findWorldCatalogRecord(worldId) ?? findWorldCatalogRecord(defaultWorldId);

  if (!selectedWorld) {
    throw new Error("No world specs are available.");
  }

  return selectedWorld.loadSpec();
}

export function findWorldCatalogEntry(worldId: string): WorldCatalogEntry | undefined {
  return worldCatalog.find((entry) => entry.id === normalizeWorldId(worldId));
}

export function normalizeWorldId(rawValue: string | null | undefined): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  const fileName = rawValue.split(/[\\/]/).pop() ?? rawValue;
  return fileName.replace(/(\.world)?\.js$/, "").replace(/\.ts$/, "");
}

function findWorldCatalogRecord(worldId: string): WorldCatalogRecord | undefined {
  return worldCatalogRecords.find((entry) => entry.id === normalizeWorldId(worldId));
}

function createWorldCatalogRecord(id: string, label: string, spec: CellComplexSpec): WorldCatalogRecord {
  return {
    id,
    label,
    spec,
    loadSpec: async () => spec,
  };
}
