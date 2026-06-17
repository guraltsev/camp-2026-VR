import * as THREE from "three";
import {
  runtimeObjectToDynamicObjectState,
  type RuntimeWorldObject,
} from "../../world-objects/runtimeObjectRegistry";
import { buildObjectCollisionWireframeInCellAxes } from "./debugCollisionWireframes";

export function buildStaticObjectCollisionWireframeGroup(
  cellId: string,
  objects: readonly RuntimeWorldObject[],
): THREE.Group | undefined {
  const group = new THREE.Group();
  group.name = `static-object-collision-wireframes:${cellId}`;

  for (const object of objects) {
    if (object.kind !== "asset" || !object.collision) {
      continue;
    }

    group.add(buildObjectCollisionWireframeInCellAxes(object.id, runtimeObjectToDynamicObjectState(object)));
  }

  return group.children.length > 0 ? group : undefined;
}
