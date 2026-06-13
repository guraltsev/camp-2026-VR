import * as THREE from "three";
import type { SingularityCollisionBox } from "../../cell-complex/forbiddenZones";
import { getDynamicObjectCollisionBounds } from "../../movement/collision";
import type { DynamicObjectState } from "../../movement/dynamicObject";
import { rigidTransformToThreeMatrix, worldPointToThree } from "./worldAxes";

const forbiddenZoneWireframeColor = 0xff3b30;
const objectCollisionWireframeColor = 0x37d67a;

export function buildForbiddenZoneWireframe(
  cellId: string,
  exclusionBox: SingularityCollisionBox,
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(exclusionBox.halfX * 2, exclusionBox.halfZ * 2, exclusionBox.halfY * 2);
  const material = new THREE.MeshBasicMaterial({
    color: forbiddenZoneWireframeColor,
    transparent: true,
    opacity: 0.9,
    wireframe: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `forbidden-zone-wireframe:${cellId}:${exclusionBox.junctionId}`;
  mesh.position.copy(worldPointToThree(exclusionBox.center));
  mesh.renderOrder = 900;
  mesh.userData = {
    kind: "debug-wireframe",
    debugWireframeKind: "forbidden-zone",
    cellId,
    junctionId: exclusionBox.junctionId,
  };
  return mesh;
}

export function buildObjectCollisionWireframe(
  objectId: string,
  object: DynamicObjectState,
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: objectCollisionWireframeColor,
    transparent: true,
    opacity: 0.95,
    wireframe: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `object-collision-wireframe:${objectId}`;
  mesh.renderOrder = 910;
  mesh.userData = {
    kind: "debug-wireframe",
    debugWireframeKind: "object-collision",
    objectId,
  };
  updateObjectCollisionWireframe(mesh, object);
  return mesh;
}

export function updateObjectCollisionWireframe(mesh: THREE.Object3D, object: DynamicObjectState): void {
  const bounds = getDynamicObjectCollisionBounds(object);

  if (!bounds) {
    mesh.visible = false;
    return;
  }

  const rootMatrix = rigidTransformToThreeMatrix(object.localPose);
  const desiredCellMatrix = new THREE.Matrix4().compose(
    worldPointToThree(bounds.center),
    new THREE.Quaternion(),
    new THREE.Vector3(bounds.halfX * 2, bounds.halfZ * 2, bounds.halfY * 2),
  );
  const localMatrix = rootMatrix.clone().invert().multiply(desiredCellMatrix);

  localMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
}
