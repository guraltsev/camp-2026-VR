import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CellComplexSpec, CellObjectSpec, PositionedCellObjectSpec, PrismCellSpec } from "../cell-complex/specs";
import { yawRigidTransform3, type RigidTransform3 } from "../math/rigidTransform3";
import { normalizeVec3, vec3, type Vec3 } from "../math/vec3";
import type { TorusSkewDeformationState } from "./deformations/torusSkewDeformation";

export interface StaticWorldDeformationState {
  readonly kind: "static-world";
}

export type WorldDeformationState = StaticWorldDeformationState | TorusSkewDeformationState;

export interface DynamicGeometryStepOptions {
  readonly maxStepMeters: number;
  readonly snapToleranceMeters?: number;
}

export interface CellDeformationMap {
  readonly cellId: string;
  mapPoint(point: Vec3): Vec3;
  mapDirection(direction: Vec3, atPoint?: Vec3): Vec3;
}

export interface WorldDeformationFamily<TState extends WorldDeformationState> {
  readonly kind: TState["kind"];

  canApplyToSpec(baseSpec: CellComplexSpec): boolean;
  normalizeState(baseSpec: CellComplexSpec, state: TState): TState;
  applyToSpec(baseSpec: CellComplexSpec, state: TState): CellComplexSpec;

  createDynamicObjectMaps(
    previous: TState,
    next: TState,
    previousWorld: CompiledCellComplex,
    nextWorld: CompiledCellComplex,
  ): ReadonlyMap<string, CellDeformationMap>;

  nextStep(
    current: TState,
    target: TState,
    options: DynamicGeometryStepOptions,
  ): TState;

  validateSnapshot(
    previousWorld: CompiledCellComplex,
    nextWorld: CompiledCellComplex,
  ): readonly string[];
}

export interface PrismBaseReplacement {
  readonly cellId: string;
  readonly baseVertices: readonly { readonly x: number; readonly y: number }[];
}

export interface RuntimePoseInCell {
  readonly cellId: string;
  readonly localPose: RigidTransform3;
}

const topologyToleranceMeters = 1e-6;

export function applyPrismBaseReplacements(
  baseSpec: CellComplexSpec,
  replacements: readonly PrismBaseReplacement[],
): CellComplexSpec {
  const replacementsByCellId = new Map(replacements.map((replacement) => [replacement.cellId, replacement]));
  const seenCellIds = new Set<string>();

  const cells = baseSpec.cells.map((cell) => {
    const replacement = replacementsByCellId.get(cell.id);
    if (!replacement) {
      return cell;
    }

    seenCellIds.add(cell.id);
    return {
      ...cell,
      baseVertices: replacement.baseVertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
    };
  });

  const missing = replacements.filter((replacement) => !seenCellIds.has(replacement.cellId));
  if (missing.length > 0) {
    throw new Error(`Cannot replace missing prism base cells: ${missing.map((replacement) => `"${replacement.cellId}"`).join(", ")}.`);
  }

  return {
    ...baseSpec,
    cells,
  };
}

export function transformPoseWithCellMaps(
  pose: RuntimePoseInCell,
  mapsByCellId: ReadonlyMap<string, CellDeformationMap>,
): RuntimePoseInCell | undefined {
  const map = mapsByCellId.get(pose.cellId);
  if (!map) {
    return undefined;
  }

  return {
    cellId: map.cellId,
    localPose: transformRigidPoseWithMap(pose.localPose, map),
  };
}

export function transformRigidPoseWithMap(
  pose: RigidTransform3,
  map: CellDeformationMap,
): RigidTransform3 {
  const translation = map.mapPoint(pose.translation);
  const heading = map.mapDirection(vec3(pose.rotation.m00, pose.rotation.m10, 0), pose.translation);
  const yawRadians = yawFromMappedHeading(heading);

  return yawRigidTransform3(yawRadians, translation);
}

export function transformPositionedObjectSpecWithMap<TObject extends CellObjectSpec>(
  object: TObject,
  map: CellDeformationMap,
): TObject {
  const yawRadians = object.turnRadians ?? object.yawRadians ?? 0;
  const transformedPose = transformRigidPoseWithMap(
    yawRigidTransform3(yawRadians, object.position),
    map,
  );
  const transformedYawRadians = yawFromRigidPose(transformedPose);
  const transformedObject = {
    ...object,
    position: transformedPose.translation,
    turnRadians: object.turnRadians === undefined ? undefined : transformedYawRadians,
    yawRadians: object.yawRadians === undefined ? undefined : transformedYawRadians,
  };

  if (object.kind === "geodesci-marmot") {
    const speedMetersPerSecond = Math.hypot(object.velocity.x, object.velocity.y);
    const mappedVelocity = speedMetersPerSecond > 0
      ? normalizeVec3(map.mapDirection(vec3(object.velocity.x, object.velocity.y, 0), object.position))
      : vec3(0, 0, 0);

    return {
      ...transformedObject,
      velocity: {
        x: mappedVelocity.x * speedMetersPerSecond,
        y: mappedVelocity.y * speedMetersPerSecond,
      },
      yawRadians: speedMetersPerSecond > 0
        ? Math.atan2(mappedVelocity.x, mappedVelocity.y)
        : transformedObject.yawRadians,
    } as TObject;
  }

  return transformedObject as TObject;
}

export function transformStartingPositionWithMap(
  startingPosition: CellComplexSpec["startingPosition"],
  mapsByCellId: ReadonlyMap<string, CellDeformationMap>,
): CellComplexSpec["startingPosition"] {
  if (!startingPosition) {
    return undefined;
  }

  const transformed = transformPoseWithCellMaps(
    {
      cellId: startingPosition.cellId,
      localPose: yawRigidTransform3(startingPosition.yawRadians ?? 0, startingPosition.position),
    },
    mapsByCellId,
  );

  if (!transformed) {
    return startingPosition;
  }

  return {
    ...startingPosition,
    cellId: transformed.cellId,
    position: transformed.localPose.translation,
    yawRadians: yawFromRigidPose(transformed.localPose),
  };
}

export function transformCellObjectsWithMaps(
  cell: PrismCellSpec,
  mapsByCellId: ReadonlyMap<string, CellDeformationMap>,
): PrismCellSpec {
  const map = mapsByCellId.get(cell.id);
  if (!map || !cell.visuals?.objects) {
    return cell;
  }

  return {
    ...cell,
    visuals: {
      ...cell.visuals,
      objects: cell.visuals.objects.map((object) => transformPositionedObjectSpecWithMap(object, map)),
    },
  };
}

export function createIdentityCellDeformationMaps(world: CompiledCellComplex): ReadonlyMap<string, CellDeformationMap> {
  return new Map(
    world.cells.map((cell) => [
      cell.id,
      {
        cellId: cell.id,
        mapPoint(point) {
          return { ...point };
        },
        mapDirection(direction) {
          return { ...direction };
        },
      },
    ]),
  );
}

export function validateTopologyPreservingSnapshot(
  previousWorld: CompiledCellComplex,
  nextWorld: CompiledCellComplex,
): readonly string[] {
  const errors: string[] = [];
  const previousCellIds = previousWorld.cells.map((cell) => cell.id).sort();
  const nextCellIds = nextWorld.cells.map((cell) => cell.id).sort();

  if (previousCellIds.join("\0") !== nextCellIds.join("\0")) {
    errors.push(
      `Cell ids changed: previous [${previousCellIds.join(", ")}], next [${nextCellIds.join(", ")}].`,
    );
  }

  for (const previousCell of previousWorld.cells) {
    const nextCell = nextWorld.cellsById.get(previousCell.id);
    if (!nextCell) {
      continue;
    }

    if (previousCell.sideCount !== nextCell.sideCount) {
      errors.push(
        `Cell "${previousCell.id}" side count changed from ${previousCell.sideCount} to ${nextCell.sideCount}.`,
      );
    }

    if (Math.abs(previousCell.heightMeters - nextCell.heightMeters) > topologyToleranceMeters) {
      errors.push(
        `Cell "${previousCell.id}" height changed from ${previousCell.heightMeters}m to ${nextCell.heightMeters}m.`,
      );
    }

    const previousPortals = [...previousCell.portals].sort((left, right) => left.id.localeCompare(right.id));
    const nextPortals = [...nextCell.portals].sort((left, right) => left.id.localeCompare(right.id));
    const previousPortalIds = previousPortals.map((portal) => portal.id);
    const nextPortalIds = nextPortals.map((portal) => portal.id);

    if (previousPortalIds.join("\0") !== nextPortalIds.join("\0")) {
      errors.push(
        `Cell "${previousCell.id}" portal ids changed: previous [${previousPortalIds.join(", ")}], next [${nextPortalIds.join(", ")}].`,
      );
    }

    for (const previousPortal of previousPortals) {
      const nextPortal = nextCell.portalsById.get(previousPortal.id);
      if (!nextPortal) {
        continue;
      }

      if (previousPortal.sideIndex !== nextPortal.sideIndex) {
        errors.push(
          `Portal "${previousCell.id}:${previousPortal.id}" side index changed from ${previousPortal.sideIndex} to ${nextPortal.sideIndex}.`,
        );
      }

      if (
        previousPortal.targetCellId !== nextPortal.targetCellId ||
        previousPortal.targetPortalId !== nextPortal.targetPortalId ||
        previousPortal.reciprocalPortalId !== nextPortal.reciprocalPortalId
      ) {
        errors.push(`Portal "${previousCell.id}:${previousPortal.id}" target pairing changed.`);
      }
    }
  }

  const checkedPairs = new Set<string>();
  for (const cell of nextWorld.cells) {
    for (const portal of cell.portals) {
      const targetCell = nextWorld.cellsById.get(portal.targetCellId);
      const targetPortal = targetCell?.portalsById.get(portal.targetPortalId);
      if (!targetCell || !targetPortal) {
        continue;
      }

      const pairKey = [cell.id, portal.id, targetCell.id, targetPortal.id].sort().join(":");
      if (checkedPairs.has(pairKey)) {
        continue;
      }
      checkedPairs.add(pairKey);

      const sourceLength = cell.sides[portal.sideIndex]?.lengthMeters;
      const targetLength = targetCell.sides[targetPortal.sideIndex]?.lengthMeters;
      if (
        sourceLength === undefined ||
        targetLength === undefined ||
        Math.abs(sourceLength - targetLength) > topologyToleranceMeters
      ) {
        errors.push(
          `Portal pair "${cell.id}:${portal.id}" <-> "${targetCell.id}:${targetPortal.id}" has incompatible side lengths.`,
        );
      }
    }
  }

  return errors;
}

export function assertTopologyPreservingSnapshot(
  previousWorld: CompiledCellComplex,
  nextWorld: CompiledCellComplex,
): void {
  const errors = validateTopologyPreservingSnapshot(previousWorld, nextWorld);
  if (errors.length > 0) {
    throw new Error(`World geometry hot swap is not topology preserving:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}

export function deformationStatesEqual(left: WorldDeformationState, right: WorldDeformationState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function yawFromMappedHeading(heading: Vec3): number {
  const horizontal = normalizeVec3({ x: heading.x, y: heading.y, z: 0 });
  return Math.atan2(horizontal.y, horizontal.x);
}

function yawFromRigidPose(pose: RigidTransform3): number {
  return Math.atan2(pose.rotation.m10, pose.rotation.m00);
}

export type DeformablePositionedObject = PositionedCellObjectSpec;
