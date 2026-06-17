import * as THREE from "three";
import type { SingularityCollisionCylinder } from "../../cell-complex/forbiddenZones";
import { getDynamicObjectCollisionBounds } from "../../movement/collision";
import type { DynamicObjectState } from "../../movement/dynamicObject";
import { rigidTransformToThreeMatrix, worldPointToThree } from "./worldAxes";

const forbiddenZoneWireframeColor = 0xff3b30;
const objectCollisionWireframeColor = 0x37d67a;
const cylinderCircleSegments = 24;

export function buildForbiddenZoneWireframe(
  cellId: string,
  exclusionCylinder: SingularityCollisionCylinder,
  displayHeightMeters?: number,
): THREE.LineSegments {
  const height = Number.isFinite(exclusionCylinder.height)
    ? exclusionCylinder.height
    : displayHeightMeters ?? Math.max(exclusionCylinder.center.z * 2, 1);
  const geometry = buildSimpleCylinderOutlineGeometry();
  const material = new THREE.LineBasicMaterial({
    color: forbiddenZoneWireframeColor,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const mesh = new THREE.LineSegments(geometry, material);
  mesh.name = `forbidden-zone-wireframe:${cellId}:${exclusionCylinder.junctionId}`;
  mesh.position.copy(worldPointToThree(exclusionCylinder.center));
  mesh.scale.set(exclusionCylinder.radius * 2, height, exclusionCylinder.radius * 2);
  mesh.renderOrder = 900;
  mesh.userData = {
    kind: "debug-wireframe",
    debugWireframeKind: "forbidden-zone",
    cellId,
    junctionId: exclusionCylinder.junctionId,
  };
  return mesh;
}

export function buildObjectCollisionWireframe(
  objectId: string,
  object: DynamicObjectState,
): THREE.LineSegments {
  const mesh = createObjectCollisionWireframe(objectId);
  updateObjectCollisionWireframe(mesh, object);
  return mesh;
}

export function buildObjectCollisionWireframeInCellAxes(
  objectId: string,
  object: DynamicObjectState,
): THREE.LineSegments {
  const mesh = createObjectCollisionWireframe(objectId);
  updateObjectCollisionWireframeInCellAxes(mesh, object);
  return mesh;
}

function createObjectCollisionWireframe(objectId: string): THREE.LineSegments {
  const geometry = buildSimpleCylinderOutlineGeometry();
  const material = new THREE.LineBasicMaterial({
    color: objectCollisionWireframeColor,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const mesh = new THREE.LineSegments(geometry, material);
  mesh.name = `object-collision-wireframe:${objectId}`;
  mesh.renderOrder = 910;
  mesh.userData = {
    kind: "debug-wireframe",
    debugWireframeKind: "object-collision",
    objectId,
  };
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
    new THREE.Vector3(bounds.radius * 2, bounds.halfHeight * 2, bounds.radius * 2),
  );
  const localMatrix = rootMatrix.clone().invert().multiply(desiredCellMatrix);

  localMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
}

export function updateObjectCollisionWireframeInCellAxes(mesh: THREE.Object3D, object: DynamicObjectState): void {
  const bounds = getDynamicObjectCollisionBounds(object);

  if (!bounds) {
    mesh.visible = false;
    return;
  }

  mesh.position.copy(worldPointToThree(bounds.center));
  mesh.quaternion.identity();
  mesh.scale.set(bounds.radius * 2, bounds.halfHeight * 2, bounds.radius * 2);
}

function buildSimpleCylinderOutlineGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const halfHeight = 0.5;

  for (let index = 0; index < cylinderCircleSegments; index += 1) {
    const startAngle = (index / cylinderCircleSegments) * Math.PI * 2;
    const endAngle = ((index + 1) / cylinderCircleSegments) * Math.PI * 2;
    addHorizontalCircleSegment(positions, -halfHeight, startAngle, endAngle);
    addHorizontalCircleSegment(positions, halfHeight, startAngle, endAngle);
  }

  addLine(positions, 0.5, -halfHeight, 0, 0.5, halfHeight, 0);
  addLine(positions, -0.5, -halfHeight, 0, -0.5, halfHeight, 0);
  addLine(positions, 0, -halfHeight, 0.5, 0, halfHeight, 0.5);
  addLine(positions, 0, -halfHeight, -0.5, 0, halfHeight, -0.5);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function addHorizontalCircleSegment(
  positions: number[],
  y: number,
  startAngle: number,
  endAngle: number,
): void {
  addLine(
    positions,
    Math.cos(startAngle) * 0.5,
    y,
    Math.sin(startAngle) * 0.5,
    Math.cos(endAngle) * 0.5,
    y,
    Math.sin(endAngle) * 0.5,
  );
}

function addLine(
  positions: number[],
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
): void {
  positions.push(startX, startY, startZ, endX, endY, endZ);
}
