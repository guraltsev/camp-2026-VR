/** Collision wireframes, selectable-hitbox, and aim-outline debug visuals attached to the cell roots. */
import * as THREE from "three";
import { type CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { type DebugLevelId } from "../../glue/debugLevels";
import { type DebugOptionId, hasActiveDebugOption } from "../../glue/debugOptions";
import { type GeodesicMarmotRuntime } from "../../world-objects/geodesicMarmot";
import { type RuntimeObjectRegistry } from "../../world-objects/runtimeObjectRegistry";
import { type SimpleGeoCreatureRuntime } from "../../world-objects/simpleGeoCreature";
import {
  buildAimCollisionOutlineDebugMesh,
  buildSelectableHitboxDebugMesh,
} from "./debugHitboxMeshes";
import { disposeObject3D } from "./runtimeSceneUtils";
import { buildStaticObjectCollisionWireframeGroup } from "./staticObjectCollisionWireframes";

export interface DebugVisualizationDeps {
  readonly runtimeObjectRegistry: RuntimeObjectRegistry;
  readonly dynamicObjectRuntimes: readonly (GeodesicMarmotRuntime | SimpleGeoCreatureRuntime)[];
  readonly cellMeshes: ReadonlyMap<string, THREE.Object3D>;
  readonly staticObjectCollisionWireframeGroupsByCellId: Map<string, THREE.Group>;
  readonly selectableHitboxDebugGroupsByCellId: Map<string, THREE.Group>;
  readonly aimCollisionOutlineDebugGroupsByCellId: Map<string, THREE.Group>;
  getWorld(): CompiledCellComplex;
  getDebugLevel(): DebugLevelId;
  getDebugOptions(): readonly DebugOptionId[];
}

export function createDebugVisualization(deps: DebugVisualizationDeps) {
  const {
    runtimeObjectRegistry,
    dynamicObjectRuntimes,
    cellMeshes,
    staticObjectCollisionWireframeGroupsByCellId,
    selectableHitboxDebugGroupsByCellId,
    aimCollisionOutlineDebugGroupsByCellId,
  } = deps;

  function syncDynamicObjectDebugWireframes(): void {
    const visible = hasActiveDebugOption(deps.getDebugLevel(), deps.getDebugOptions(), "object-collision-wireframes");

    for (const runtime of dynamicObjectRuntimes) {
      runtime.setCollisionWireframeVisible(visible);
    }
  }

  function syncStaticObjectCollisionWireframes(): void {
    for (const group of staticObjectCollisionWireframeGroupsByCellId.values()) {
      group.removeFromParent();
      disposeObject3D(group);
    }
    staticObjectCollisionWireframeGroupsByCellId.clear();

    if (!hasActiveDebugOption(deps.getDebugLevel(), deps.getDebugOptions(), "object-collision-wireframes")) {
      return;
    }

    for (const cell of deps.getWorld().cells) {
      const cellRoot = cellMeshes.get(cell.id);
      if (!cellRoot) {
        continue;
      }

      const group = buildStaticObjectCollisionWireframeGroup(cell.id, runtimeObjectRegistry.getObjectsInCell(cell.id));
      if (!group) {
        continue;
      }

      staticObjectCollisionWireframeGroupsByCellId.set(cell.id, group);
      cellRoot.add(group);
    }
  }

  function syncSelectableHitboxDebug(): void {
    for (const group of selectableHitboxDebugGroupsByCellId.values()) {
      group.removeFromParent();
      disposeObject3D(group);
    }
    selectableHitboxDebugGroupsByCellId.clear();

    for (const group of aimCollisionOutlineDebugGroupsByCellId.values()) {
      group.removeFromParent();
      disposeObject3D(group);
    }
    aimCollisionOutlineDebugGroupsByCellId.clear();

    const selectableHitboxesActive = hasActiveDebugOption(deps.getDebugLevel(), deps.getDebugOptions(), "selectable-hitboxes");
    const aimCollisionOutlinesActive = hasActiveDebugOption(deps.getDebugLevel(), deps.getDebugOptions(), "aim-collision-outlines");
    if (!selectableHitboxesActive && !aimCollisionOutlinesActive) {
      return;
    }

    for (const cell of deps.getWorld().cells) {
      const cellRoot = cellMeshes.get(cell.id);
      if (!cellRoot) {
        continue;
      }

      if (selectableHitboxesActive) {
        const group = new THREE.Group();
        group.name = `selectable-hitboxes:${cell.id}`;
        for (const object of runtimeObjectRegistry.getObjectsInCell(cell.id)) {
          const hitbox = buildSelectableHitboxDebugMesh(object);
          if (hitbox) {
            group.add(hitbox);
          }
        }

        if (group.children.length > 0) {
          cellRoot.add(group);
          selectableHitboxDebugGroupsByCellId.set(cell.id, group);
        } else {
          disposeObject3D(group);
        }
      }

      if (aimCollisionOutlinesActive) {
        const group = new THREE.Group();
        group.name = `aim-collision-outlines:${cell.id}`;
        for (const object of runtimeObjectRegistry.getObjectsInCell(cell.id)) {
          const outline = buildAimCollisionOutlineDebugMesh(object);
          if (outline) {
            group.add(outline);
          }
        }

        if (group.children.length > 0) {
          cellRoot.add(group);
          aimCollisionOutlineDebugGroupsByCellId.set(cell.id, group);
        } else {
          disposeObject3D(group);
        }
      }
    }
  }

  return { syncDynamicObjectDebugWireframes, syncStaticObjectCollisionWireframes, syncSelectableHitboxDebug };
}
