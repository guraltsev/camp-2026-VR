import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { getDynamicObjectCollisionBounds, signedDistanceToSide, testCellCollision } from "../../movement/collision";
import { runtimeObjectToDynamicObjectState, type RuntimeObjectRegistry } from "../../world-objects/runtimeObjectRegistry";
import type { GeodesciMarmotRuntime } from "../../world-objects/geodesciMarmot";
import type { SimpleGeoCreatureRuntime } from "../../world-objects/simpleGeoCreature";
import { worldPointToThree } from "./worldAxes";

export type GeodesicCreatureRuntime = GeodesciMarmotRuntime | SimpleGeoCreatureRuntime;

export interface GeodesicCreatureDebugRecord {
  readonly id: string;
  readonly kind?: string;
  readonly runtimeCellId: string;
  readonly registryCellId?: string;
  readonly parentCellId?: string;
  readonly localPosition?: { readonly x: number; readonly y: number; readonly z: number };
  readonly threePosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly expectedThreePosition?: { readonly x: number; readonly y: number; readonly z: number };
  readonly collisionCenter?: { readonly x: number; readonly y: number; readonly z: number };
  readonly collisionRadius?: number;
  readonly collisionHalfHeight?: number;
  readonly renderVisible: boolean;
  readonly ancestorsVisible: boolean;
  readonly issues: readonly string[];
}

export interface GeodesicCreatureDebugDump {
  readonly checkedAtIso: string;
  readonly creatureCount: number;
  readonly issueCount: number;
  readonly records: readonly GeodesicCreatureDebugRecord[];
}

export function collectGeodesicCreatureDebugDump(options: {
  readonly world: CompiledCellComplex;
  readonly runtimes: readonly GeodesicCreatureRuntime[];
  readonly registry: RuntimeObjectRegistry;
  readonly cellRoots: ReadonlyMap<string, THREE.Object3D>;
}): GeodesicCreatureDebugDump {
  const records = options.runtimes.map((runtime) =>
    collectGeodesicCreatureDebugRecord(runtime, options.world, options.registry, options.cellRoots),
  );

  return {
    checkedAtIso: new Date().toISOString(),
    creatureCount: records.length,
    issueCount: records.reduce((total, record) => total + record.issues.length, 0),
    records,
  };
}

function collectGeodesicCreatureDebugRecord(
  runtime: GeodesicCreatureRuntime,
  world: CompiledCellComplex,
  registry: RuntimeObjectRegistry,
  cellRoots: ReadonlyMap<string, THREE.Object3D>,
): GeodesicCreatureDebugRecord {
  runtime.root.updateMatrixWorld(true);

  const object = registry.get(runtime.objectId);
  const cell = world.cellsById.get(runtime.cellId);
  const expectedParent = cellRoots.get(runtime.cellId);
  const parentCellId = findParentCellId(runtime.root.parent, cellRoots);
  const worldPosition = new THREE.Vector3();
  runtime.root.getWorldPosition(worldPosition);

  const issues: string[] = [];

  if (!cell) {
    issues.push("runtime-cell-missing");
  }

  if (!object) {
    issues.push("registry-object-missing");
  } else {
    if (object.cellId !== runtime.cellId) {
      issues.push("registry-cell-mismatch");
    }

    if (object.kind !== "geodesci-marmot" && object.kind !== "geo-mouse" && object.kind !== "geo-butterfly") {
      issues.push("registry-kind-mismatch");
    }
  }

  if (expectedParent && runtime.root.parent !== expectedParent) {
    issues.push("parent-cell-mismatch");
  }

  const ancestorsVisible = objectAndAncestorsVisible(runtime.root);

  if (!runtime.root.visible || (!object?.portalRenderable && !ancestorsVisible)) {
    issues.push("render-hidden");
  }

  if (!isFiniteThreeVector(runtime.root.position)) {
    issues.push("root-position-non-finite");
  }

  if (!isFiniteThreeVector(worldPosition)) {
    issues.push("world-position-non-finite");
  }

  const state = object ? runtimeObjectToDynamicObjectState(object) : undefined;
  const expectedThreePosition = state ? worldPointToThree(state.localPose.translation) : undefined;

  if (state && !isFiniteVec3(state.localPose.translation)) {
    issues.push("local-position-non-finite");
  }

  if (expectedThreePosition && runtime.root.position.distanceTo(expectedThreePosition) > 1e-4) {
    issues.push("root-pose-mismatch");
  }

  const bounds = state ? getDynamicObjectCollisionBounds(state) : undefined;

  if (bounds && !isFiniteVec3(bounds.center)) {
    issues.push("collision-center-non-finite");
  }

  if (bounds && (!Number.isFinite(bounds.radius) || !Number.isFinite(bounds.halfHeight))) {
    issues.push("collision-size-non-finite");
  }

  if (cell && state) {
    const collision = testCellCollision({
      cell,
      object: state,
      ignoreForbiddenZones: true,
    });

    if (collision.blocked) {
      issues.push(`collision-${collision.reason ?? "blocked"}`);
    }

    if (bounds) {
      for (const side of cell.sides) {
        if (signedDistanceToSide(side, bounds.center) < -bounds.radius) {
          issues.push(`outside-side-${side.sideIndex}`);
        }
      }
    }
  }

  return {
    id: runtime.objectId,
    kind: object?.kind,
    runtimeCellId: runtime.cellId,
    registryCellId: object?.cellId,
    parentCellId,
    localPosition: state ? roundVec3(state.localPose.translation) : undefined,
    threePosition: roundThreeVector3(runtime.root.position),
    expectedThreePosition: expectedThreePosition ? roundThreeVector3(expectedThreePosition) : undefined,
    collisionCenter: bounds ? roundVec3(bounds.center) : undefined,
    collisionRadius: bounds ? roundNumber(bounds.radius) : undefined,
    collisionHalfHeight: bounds ? roundNumber(bounds.halfHeight) : undefined,
    renderVisible: runtime.root.visible,
    ancestorsVisible,
    issues,
  };
}

function findParentCellId(
  parent: THREE.Object3D | null,
  cellRoots: ReadonlyMap<string, THREE.Object3D>,
): string | undefined {
  for (const [cellId, root] of cellRoots) {
    if (parent === root) {
      return cellId;
    }
  }

  return undefined;
}

function isFiniteThreeVector(value: THREE.Vector3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function objectAndAncestorsVisible(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;

  while (current) {
    if (!current.visible) {
      return false;
    }

    current = current.parent;
  }

  return true;
}

function isFiniteVec3(value: { readonly x: number; readonly y: number; readonly z: number }): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function roundVec3(point: { readonly x: number; readonly y: number; readonly z: number }): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  return {
    x: roundNumber(point.x),
    y: roundNumber(point.y),
    z: roundNumber(point.z),
  };
}

function roundThreeVector3(point: THREE.Vector3): { readonly x: number; readonly y: number; readonly z: number } {
  return roundVec3(point);
}

function roundNumber(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
