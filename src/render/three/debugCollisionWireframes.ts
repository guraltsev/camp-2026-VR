import * as THREE from "three";
import type { SingularityCollisionColumn } from "../../cell-complex/forbiddenZones";
import type { SimpleCollisionBox } from "../../movement/dynamicObject";
import { worldPointToThree } from "./worldAxes";

const forbiddenZoneWireframeColor = 0xff3b30;
const objectCollisionWireframeColor = 0x37d67a;

export function buildForbiddenZoneWireframe(
  cellId: string,
  column: SingularityCollisionColumn,
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(
    column.radiusMeters,
    column.radiusMeters,
    column.heightMeters,
    24,
    1,
    true,
  );
  const material = new THREE.MeshBasicMaterial({
    color: forbiddenZoneWireframeColor,
    transparent: true,
    opacity: 0.9,
    wireframe: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `forbidden-zone-wireframe:${cellId}:${column.junctionId}`;
  mesh.position.copy(worldPointToThree(column.center));
  mesh.renderOrder = 900;
  mesh.userData = {
    kind: "debug-wireframe",
    debugWireframeKind: "forbidden-zone",
    cellId,
    junctionId: column.junctionId,
  };
  return mesh;
}

export function buildObjectCollisionWireframe(
  objectId: string,
  collision: SimpleCollisionBox,
): THREE.Mesh {
  const offset = collision.offset ?? { x: 0, y: 0, z: 0 };
  const geometry = new THREE.BoxGeometry(collision.dx, collision.dz, collision.dy);
  const material = new THREE.MeshBasicMaterial({
    color: objectCollisionWireframeColor,
    transparent: true,
    opacity: 0.95,
    wireframe: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `object-collision-wireframe:${objectId}`;
  mesh.position.set(offset.x, offset.z, -offset.y);
  mesh.renderOrder = 910;
  mesh.userData = {
    kind: "debug-wireframe",
    debugWireframeKind: "object-collision",
    objectId,
  };
  return mesh;
}
