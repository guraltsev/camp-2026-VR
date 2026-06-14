import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import { testCellCollision, getDynamicObjectCollisionBounds, simpleCylinderIntersectsSimpleCylinder } from "../movement/collision";
import type { DynamicObjectState, SimpleCollisionCylinder } from "../movement/dynamicObject";
import { yawRigidTransform3, type RigidTransform3 } from "../math/rigidTransform3";
import type { Vec3 } from "../math/vec3";
import type { RuntimeObjectInteraction, RuntimeWorldObjectBase, RuntimeObjectRegistry } from "./runtimeObjectRegistry";
import { runtimeObjectToDynamicObjectState } from "./runtimeObjectRegistry";

export const placedFlagTypes = ["WoodenSign1", "WoodenSign2"] as const;
export type PlacedFlagType = typeof placedFlagTypes[number];

export const placedFlagAssetPaths: Record<PlacedFlagType, string> = {
  WoodenSign1: "WoodenSign1/WoodenSign1.glb",
  WoodenSign2: "WoodenSign2/WoodenSign2.glb",
};

export const defaultPlacedFlagFontColor = "#f8fafc";
export const placedFlagFontColors = [defaultPlacedFlagFontColor, "#111827", "#ef4444", "#2563eb", "#16a34a"] as const;
export const placedFlagMaxMessageLength = 20;

export interface PlacedFlagObject extends RuntimeWorldObjectBase {
  readonly kind: "placed-flag";
  readonly flagType: PlacedFlagType;
  readonly message: string;
  readonly fontColor: string;
}

export interface CreatePlacedFlagOptions {
  readonly id: string;
  readonly cellId: string;
  readonly localPose: RigidTransform3;
  readonly flagType: PlacedFlagType;
  readonly message?: string;
  readonly fontColor?: string;
  readonly collision?: SimpleCollisionCylinder;
}

export interface PlaceFlagFromAimRequest {
  readonly world: CompiledCellComplex;
  readonly registry: RuntimeObjectRegistry;
  readonly cellId: string;
  readonly eyePosition: Vec3;
  readonly forward: Vec3;
  readonly flagType: PlacedFlagType;
  readonly id: string;
}

export interface PlaceFlagResult {
  readonly placed: boolean;
  readonly object?: PlacedFlagObject;
  readonly reason?: "no-floor-hit" | "missing-cell" | "cell-collision" | "runtime-object-collision";
}

const defaultFlagCollision: SimpleCollisionCylinder = {
  radius: 0.475,
  height: 1.15,
  offset: { x: 0, y: 0, z: 0.575 },
};

const defaultFlagInteraction: RuntimeObjectInteraction = {
  label: "Edit flag",
  action: "edit-flag",
  rangeMeters: 2.25,
};

export function isPlacedFlagType(value: string): value is PlacedFlagType {
  return (placedFlagTypes as readonly string[]).includes(value);
}

export function sanitizePlacedFlagMessage(message: string): string {
  return [...message.replace(/\s+/g, " ").trim()].slice(0, placedFlagMaxMessageLength).join("");
}

export function sanitizePlacedFlagFontColor(color: string): string {
  return (placedFlagFontColors as readonly string[]).includes(color) ? color : defaultPlacedFlagFontColor;
}

export function defaultPlacedFlagMessage(
  flagType: PlacedFlagType,
  existingObjects: readonly PlacedFlagObject[] = [],
): string {
  const prefix = flagType === "WoodenSign1" ? "A" : "B";
  let maxNumber = 0;

  for (const object of existingObjects) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(object.message);
    if (match) {
      maxNumber = Math.max(maxNumber, Number(match[1]));
    }
  }

  return `${prefix}${maxNumber + 1}`;
}

export function createPlacedFlagObject(options: CreatePlacedFlagOptions): PlacedFlagObject {
  return {
    id: options.id,
    kind: "placed-flag",
    cellId: options.cellId,
    localPose: options.localPose,
    collision: options.collision ?? defaultFlagCollision,
    portalRenderable: true,
    tooltip: {
      label: "flag",
      rangeMeters: 2.25,
      desktopPrompt: 'Press "F" to edit',
      xrPrompt: 'Press "A" to edit',
    },
    interactable: defaultFlagInteraction,
    flagType: options.flagType,
    message: sanitizePlacedFlagMessage(options.message ?? defaultPlacedFlagMessage(options.flagType)),
    fontColor: sanitizePlacedFlagFontColor(options.fontColor ?? defaultPlacedFlagFontColor),
  };
}

export function updatePlacedFlagMessage(object: PlacedFlagObject, message: string): PlacedFlagObject {
  return {
    ...object,
    message: sanitizePlacedFlagMessage(message),
  };
}

export function updatePlacedFlagFontColor(object: PlacedFlagObject, fontColor: string): PlacedFlagObject {
  return {
    ...object,
    fontColor: sanitizePlacedFlagFontColor(fontColor),
  };
}

export function placedFlagToDynamicObjectState(object: PlacedFlagObject): DynamicObjectState {
  return runtimeObjectToDynamicObjectState(object);
}

export function placeFlagFromAim(request: PlaceFlagFromAimRequest): PlaceFlagResult {
  const cell = request.world.cellsById.get(request.cellId);
  if (!cell) {
    return { placed: false, reason: "missing-cell" };
  }

  if (request.forward.z >= -0.02) {
    return { placed: false, reason: "no-floor-hit" };
  }

  const distance = -request.eyePosition.z / request.forward.z;
  if (!Number.isFinite(distance) || distance <= 0 || distance > 8) {
    return { placed: false, reason: "no-floor-hit" };
  }

  const floorPoint = {
    x: request.eyePosition.x + request.forward.x * distance,
    y: request.eyePosition.y + request.forward.y * distance,
    z: 0,
  };
  const yawRadians = Math.atan2(request.eyePosition.x - floorPoint.x, request.eyePosition.y - floorPoint.y);
  const candidate = createPlacedFlagObject({
    id: request.id,
    cellId: request.cellId,
    localPose: yawRigidTransform3(yawRadians, floorPoint),
    flagType: request.flagType,
    message: defaultPlacedFlagMessage(
      request.flagType,
      request.registry.getAll().filter((object): object is PlacedFlagObject => object.kind === "placed-flag"),
    ),
  });
  const candidateState = placedFlagToDynamicObjectState(candidate);
  const collision = testCellCollision({ cell, object: candidateState });
  if (collision.blocked) {
    return { placed: false, reason: "cell-collision" };
  }

  const candidateBounds = getDynamicObjectCollisionBounds(candidateState);
  if (candidateBounds) {
    for (const object of request.registry.getCollidableObjectsInCell(request.cellId)) {
      const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
      if (bounds && simpleCylinderIntersectsSimpleCylinder(candidateBounds, bounds)) {
        return { placed: false, reason: "runtime-object-collision" };
      }
    }
  }

  request.registry.add(candidate);
  return { placed: true, object: candidate };
}
