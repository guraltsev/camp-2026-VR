import type { RigidTransform3 } from "../math/rigidTransform3";
import type { DynamicObjectState, SimpleCollisionCylinder } from "../movement/dynamicObject";
import type { AssetObjectSpec } from "../cell-complex/specs";
import { yawRigidTransform3 } from "../math/rigidTransform3";
import type { GeodesicCannonObject, GeodesicIntersectionObject, GeodesicSegmentObject } from "./geodesicCannon";
import type { MeasuredGeodesicLengthObject } from "./measureLengthTool";
import type { PlacedFlagObject } from "./placedFlags";
import type { ProtractorAngleObject } from "./protractorTool";
import { userObjectClass } from "./objectMetadata";

export interface RuntimeObjectInteraction {
  readonly label: string;
  readonly action: "edit-flag" | "select-geodesic-cannon" | "open-geometry-computer";
  readonly rangeMeters?: number;
}

export interface RuntimeObjectTooltip {
  readonly label: string;
  readonly rangeMeters?: number;
  readonly desktopPrompt?: string;
  readonly xrPrompt?: string;
}

export interface RuntimeWorldObjectBase {
  readonly id: string;
  readonly cellId: string;
  readonly localPose: RigidTransform3;
  readonly collision?: SimpleCollisionCylinder;
  readonly class?: string;
  readonly do_not_collide_with?: readonly string[];
  readonly aimStickyTarget?: {
    readonly localPoint: RigidTransform3["translation"];
  };
  readonly portalRenderable: boolean;
  readonly tooltip?: RuntimeObjectTooltip;
  readonly interactable?: RuntimeObjectInteraction;
  readonly displayHelpMessage?: string;
  readonly autoDisplayHelpRangeMeters?: number;
}

export interface RuntimeCreatureObject extends RuntimeWorldObjectBase {
  readonly kind: "geodesci-marmot" | "geo-mouse" | "geo-butterfly";
}

export interface RuntimeStaticAssetObject extends RuntimeWorldObjectBase {
  readonly kind: "asset";
  readonly assetPath: string;
}

export type RuntimeWorldObject =
  | RuntimeCreatureObject
  | RuntimeStaticAssetObject
  | PlacedFlagObject
  | GeodesicCannonObject
  | GeodesicSegmentObject
  | GeodesicIntersectionObject
  | MeasuredGeodesicLengthObject
  | ProtractorAngleObject;

export interface RuntimeObjectRegistry {
  add(object: RuntimeWorldObject): void;
  update(object: RuntimeWorldObject): void;
  remove(id: string): void;
  moveToCell(id: string, cellId: string, localPose?: RigidTransform3): RuntimeWorldObject | undefined;
  get(id: string): RuntimeWorldObject | undefined;
  getObjectsInCell(cellId: string): readonly RuntimeWorldObject[];
  getCollidableObjectsInCell(cellId: string): readonly RuntimeWorldObject[];
  getPlayerBlockingObjectsInCell(cellId: string): readonly RuntimeWorldObject[];
  getInteractableObjectsInCell(cellId: string): readonly RuntimeWorldObject[];
  getTooltipObjectsInCell(cellId: string): readonly RuntimeWorldObject[];
  getAll(): readonly RuntimeWorldObject[];
}

export function createRuntimeObjectRegistry(
  initialObjects: readonly RuntimeWorldObject[] = [],
): RuntimeObjectRegistry {
  const objectsById = new Map<string, RuntimeWorldObject>();
  const objectIdsByCellId = new Map<string, Set<string>>();

  function indexObject(object: RuntimeWorldObject): void {
    let cellIds = objectIdsByCellId.get(object.cellId);
    if (!cellIds) {
      cellIds = new Set<string>();
      objectIdsByCellId.set(object.cellId, cellIds);
    }
    cellIds.add(object.id);
  }

  function unindexObject(object: RuntimeWorldObject): void {
    const cellIds = objectIdsByCellId.get(object.cellId);
    cellIds?.delete(object.id);
    if (cellIds?.size === 0) {
      objectIdsByCellId.delete(object.cellId);
    }
  }

  const registry: RuntimeObjectRegistry = {
    add(object) {
      if (objectsById.has(object.id)) {
        throw new Error(`Runtime object "${object.id}" already exists.`);
      }

      objectsById.set(object.id, object);
      indexObject(object);
    },
    update(object) {
      const previous = objectsById.get(object.id);
      if (!previous) {
        throw new Error(`Cannot update missing runtime object "${object.id}".`);
      }

      if (previous.cellId !== object.cellId) {
        unindexObject(previous);
        indexObject(object);
      }

      objectsById.set(object.id, object);
    },
    remove(id) {
      const object = objectsById.get(id);
      if (!object) {
        return;
      }

      unindexObject(object);
      objectsById.delete(id);
    },
    moveToCell(id, cellId, localPose) {
      const object = objectsById.get(id);
      if (!object) {
        return undefined;
      }

      const next = {
        ...object,
        cellId,
        localPose: localPose ?? object.localPose,
      } as RuntimeWorldObject;
      registry.update(next);
      return next;
    },
    get(id) {
      return objectsById.get(id);
    },
    getObjectsInCell(cellId) {
      return [...(objectIdsByCellId.get(cellId) ?? [])]
        .map((id) => objectsById.get(id))
        .filter((object): object is RuntimeWorldObject => object !== undefined);
    },
    getCollidableObjectsInCell(cellId) {
      return registry.getObjectsInCell(cellId).filter((object) => object.collision !== undefined);
    },
    getPlayerBlockingObjectsInCell(cellId) {
      return registry.getCollidableObjectsInCell(cellId).filter(
        (object) => object.kind !== "geodesic-cannon" && !object.do_not_collide_with?.includes(userObjectClass),
      );
    },
    getInteractableObjectsInCell(cellId) {
      return registry.getObjectsInCell(cellId).filter((object) => object.interactable !== undefined);
    },
    getTooltipObjectsInCell(cellId) {
      return registry.getObjectsInCell(cellId).filter(
        (object) => object.tooltip !== undefined || object.interactable !== undefined,
      );
    },
    getAll() {
      return [...objectsById.values()];
    },
  };

  for (const object of initialObjects) {
    registry.add(object);
  }

  return registry;
}

export function runtimeObjectToDynamicObjectState(object: RuntimeWorldObjectBase): DynamicObjectState {
  return {
    cellId: object.cellId,
    localPose: object.localPose,
    collision: object.collision,
  };
}

export function createRuntimeStaticAssetObject(
  objectSpec: AssetObjectSpec,
  cellId: string,
): RuntimeStaticAssetObject {
  const geometryComputer = objectSpec.class === "geometry-computer";
  const helpTooltip = !geometryComputer && objectSpec.displayHelpMessage
    ? {
        label: objectSpec.class === "question-cube" ? "Question cube" : objectSpec.class ?? objectSpec.id,
        rangeMeters: objectSpec.autoDisplayHelpRangeMeters ?? 2.5,
      }
    : undefined;

  return {
    id: objectSpec.id,
    kind: "asset",
    assetPath: objectSpec.assetPath,
    cellId,
    localPose: yawRigidTransform3(
      objectSpec.turnRadians ?? objectSpec.yawRadians ?? 0,
      objectSpec.position,
    ),
    collision: objectSpec.collision,
    class: objectSpec.class,
    do_not_collide_with: objectSpec.do_not_collide_with,
    portalRenderable: false,
    displayHelpMessage: objectSpec.displayHelpMessage ?? (geometryComputer
      ? "Use this computer to change the torus skew when the current world supports live geometry changes."
      : undefined),
    autoDisplayHelpRangeMeters: objectSpec.autoDisplayHelpRangeMeters,
    tooltip: geometryComputer
      ? {
          label: "Geometry computer",
          rangeMeters: 3,
        }
      : helpTooltip,
    interactable: geometryComputer
      ? {
          label: "Set torus skew",
          action: "open-geometry-computer",
          rangeMeters: 3,
        }
      : undefined,
  };
}
