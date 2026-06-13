import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import type { CompiledPrismCell } from "../../cell-complex/prismCells";
import {
  buildStaticallyCulledPortalPathTables,
  type StaticPortalPathCullResult,
} from "../../cell-complex/staticPortalPathCull";
import type { DebugLevelId } from "../../glue/debugLevels";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import { buildCellMesh } from "./buildCellMesh";
import { patchPortalClipMaterial, type PortalClipMaterialState } from "./portalClipMaterial";
import type { PreparedWorldAssets } from "./preloadWorldAssets";

export type CellRenderArchetypeKind =
  | "floor"
  | "solid-wall"
  | "portal-frame"
  | "static-object"
  | "debug-wireframe";

export interface CellRenderArchetype {
  readonly cellId: string;
  readonly archetypeId: string;
  readonly kind: CellRenderArchetypeKind;
  readonly mesh: THREE.InstancedMesh;
  readonly portalPathIdAttribute: THREE.InstancedBufferAttribute;
  readonly portalClipIndexAttribute: THREE.InstancedBufferAttribute;
  readonly capacity: number;
  readonly sourceObjectName?: string;
}

export interface BuildCellRenderArchetypesOptions {
  readonly debugLevel: DebugLevelId;
  readonly portalPanelMode: PortalPanelModeId;
  readonly eyeHeightMeters: number;
  readonly assets: PreparedWorldAssets;
  readonly capacitiesByCellId: ReadonlyMap<string, number>;
  readonly portalClipMaterialState?: PortalClipMaterialState;
  readonly showForbiddenZoneWireframes?: boolean;
}

export interface CellRenderArchetypePlanEntry {
  readonly cellId: string;
  readonly archetypeId: string;
  readonly kind: CellRenderArchetypeKind;
  readonly capacity: number;
  readonly sourceObjectName?: string;
}

export function buildCellRenderArchetypes(
  world: CompiledCellComplex,
  options: BuildCellRenderArchetypesOptions,
): readonly CellRenderArchetype[] {
  const archetypes: CellRenderArchetype[] = [];

  for (const cell of world.cells) {
    const sources = collectCellArchetypeSources(cell, options);

    for (const source of sources) {
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, source.capacity);
      const portalPathIdAttribute = new THREE.InstancedBufferAttribute(new Float32Array(source.capacity), 1);
      const portalClipIndexAttribute = new THREE.InstancedBufferAttribute(new Float32Array(source.capacity), 1);
      mesh.name = source.archetypeId;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      portalPathIdAttribute.setUsage(THREE.DynamicDrawUsage);
      portalClipIndexAttribute.setUsage(THREE.DynamicDrawUsage);
      mesh.geometry.setAttribute("portalPathId", portalPathIdAttribute);
      mesh.geometry.setAttribute("portalClipIndex", portalClipIndexAttribute);
      mesh.userData = {
        kind: "cell-render-archetype",
        cellId: source.cellId,
        archetypeId: source.archetypeId,
        archetypeKind: source.kind,
        sourceObjectName: source.sourceObjectName,
      };
      archetypes.push({
        cellId: source.cellId,
        archetypeId: source.archetypeId,
        kind: source.kind,
        mesh,
        portalPathIdAttribute,
        portalClipIndexAttribute,
        capacity: source.capacity,
        sourceObjectName: source.sourceObjectName,
      });
    }
  }

  return archetypes;
}

export function planCellRenderArchetypes(
  world: CompiledCellComplex,
  options: BuildCellRenderArchetypesOptions,
): readonly CellRenderArchetypePlanEntry[] {
  return world.cells.flatMap((cell) =>
    collectCellArchetypeSources(cell, options).map((source) => ({
      cellId: source.cellId,
      archetypeId: source.archetypeId,
      kind: source.kind,
      capacity: source.capacity,
      sourceObjectName: source.sourceObjectName,
    })),
  );
}

export function deriveCellRenderArchetypeCapacities(
  world: CompiledCellComplex,
  staticCull: StaticPortalPathCullResult,
  maxVisiblePaths?: number,
): ReadonlyMap<string, number> {
  const capacities = new Map(world.cells.map((cell) => [cell.id, 0]));

  for (const table of staticCull.tables.tablesByRootCellId.values()) {
    for (const [cellId, paths] of table.pathsByDestinationCellId) {
      capacities.set(cellId, Math.max(capacities.get(cellId) ?? 0, paths.length));
    }
  }

  for (const cell of world.cells) {
    const capacity = capacities.get(cell.id) ?? 0;
    const clampedCapacity =
      maxVisiblePaths === undefined ? capacity : Math.min(capacity, Math.max(0, maxVisiblePaths));
    capacities.set(cell.id, Math.max(1, clampedCapacity));
  }

  return capacities;
}

export function buildDefaultCellRenderArchetypeCapacities(
  world: CompiledCellComplex,
  maxDepth: number,
  maxVisiblePaths?: number,
): ReadonlyMap<string, number> {
  const staticCull = buildStaticallyCulledPortalPathTables(world, {
    maxDepth,
    skipImmediateReverse: true,
    toleranceMeters: 1e-6,
    maxKeptPathsPerRoot: 50_000,
  });

  return deriveCellRenderArchetypeCapacities(world, staticCull, maxVisiblePaths);
}

export function disposeCellRenderArchetypes(archetypes: readonly CellRenderArchetype[]): void {
  for (const archetype of archetypes) {
    archetype.mesh.geometry.dispose();
    disposeMaterial(archetype.mesh.material);
  }
}

interface CellArchetypeSource {
  readonly cellId: string;
  readonly archetypeId: string;
  readonly kind: CellRenderArchetypeKind;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material | THREE.Material[];
  readonly capacity: number;
  readonly sourceObjectName?: string;
}

function collectCellArchetypeSources(
  cell: CompiledPrismCell,
  options: BuildCellRenderArchetypesOptions,
): readonly CellArchetypeSource[] {
  const sourceRoot = buildCellMesh(cell, {
    debugLevel: options.debugLevel,
    portalPanelMode: options.portalPanelMode,
    eyeHeightMeters: options.eyeHeightMeters,
    assets: options.assets,
    showForbiddenZoneWireframes: options.showForbiddenZoneWireframes,
  });
  sourceRoot.updateMatrixWorld(true);

  const capacity = options.capacitiesByCellId.get(cell.id) ?? 1;
  const sources: CellArchetypeSource[] = [];

  sourceRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const kind = classifyObjectKind(object);

    if (!kind) {
      return;
    }

    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const material = cloneMaterial(object.material, options.portalClipMaterialState);
    const archetypeIndex = sources.length;
    sources.push({
      cellId: cell.id,
      archetypeId: `${cell.id}:${kind}:${archetypeIndex}`,
      kind,
      geometry,
      material,
      capacity,
      sourceObjectName: object.name || undefined,
    });
  });

  disposeObject3D(sourceRoot);
  return sources;
}

function classifyObjectKind(object: THREE.Mesh): CellRenderArchetypeKind | undefined {
  if (object.name.startsWith("floor:")) {
    return "floor";
  }

  if (object.name.startsWith("ceiling:")) {
    // The ceiling is a sky-colored collision cap. Rendering it through
    // portal clip polygons makes aperture edges visible against the sky.
    return undefined;
  }

  if (object.userData.kind === "solid-wall") {
    return "solid-wall";
  }

  if (object.userData.kind === "portal-wall-mesh") {
    return "portal-frame";
  }

  if (object.name.startsWith("portal-debug-panel:") || object.name.startsWith("portal-debug-label:")) {
    return "portal-frame";
  }

  if (object.name.startsWith("floor-outline:")) {
    return undefined;
  }

  if (object.userData.kind === "debug-wireframe") {
    return "debug-wireframe";
  }

  if (hasAncestorNamed(object, "decoration:") || hasAncestorNamed(object, "asset:")) {
    return "static-object";
  }

  return undefined;
}

function hasAncestorNamed(object: THREE.Object3D, prefix: string): boolean {
  let current: THREE.Object3D | null = object;

  while (current) {
    if (current.name.startsWith(prefix)) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function cloneMaterial(
  material: THREE.Material | THREE.Material[],
  portalClipMaterialState: PortalClipMaterialState | undefined,
): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    const cloned = material.map((entry) => entry.clone());
    return portalClipMaterialState ? patchPortalClipMaterial(cloned, portalClipMaterialState) : cloned;
  }

  const cloned = material.clone();
  return portalClipMaterialState ? patchPortalClipMaterial(cloned, portalClipMaterialState) : cloned;
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.geometry.dispose();
    disposeMaterial(child.material);
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      entry.dispose();
    }
    return;
  }

  material.dispose();
}
