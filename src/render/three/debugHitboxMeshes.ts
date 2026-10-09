/** Debug meshes for selectable hitboxes and aim collision outlines. */
import * as THREE from "three";
import { type SimpleCylinderBounds, getDynamicObjectCollisionBounds } from "../../movement/collision";
import { createProtractorAngleLabelHitbox } from "../../world-objects/protractorTool";
import { type RuntimeWorldObject, runtimeObjectToDynamicObjectState } from "../../world-objects/runtimeObjectRegistry";
import {
  geodesicSegmentAimRadiusMeters,
  getGeodesicEmitterAimCylinderBounds,
  getGeodesicEmitterAimSphereCenter,
} from "./aimTarget";
import { worldPointToThree } from "./worldAxes";

export const selectableGeodesicSegmentHitboxDebugColor = 0xff2bd6;
export const aimCollisionOutlineDebugColor = 0xff44ff;
export const selectableHitboxDebugOpacity = 0.24;
export const aimCollisionOutlineDebugOpacity = 0.82;
export const selectableHitboxDebugRenderOrder = 930;
export const aimCollisionOutlineDebugRenderOrder = 935;

export function buildCylinderSelectableHitboxDebugMesh(
  bounds: SimpleCylinderBounds,
  color: number,
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
  const material = createSelectableHitboxDebugMaterial(color);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "selectable-hitbox:cylinder";
  mesh.position.copy(worldPointToThree(bounds.center));
  mesh.scale.set(bounds.radius, bounds.halfHeight * 2, bounds.radius);
  mesh.renderOrder = selectableHitboxDebugRenderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

export function buildCylinderAimCollisionOutlineDebugMesh(
  bounds: SimpleCylinderBounds,
  name: string,
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
  const material = createAimCollisionOutlineDebugMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(worldPointToThree(bounds.center));
  mesh.scale.set(bounds.radius, bounds.halfHeight * 2, bounds.radius);
  mesh.renderOrder = aimCollisionOutlineDebugRenderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

export function buildSphereAimCollisionOutlineDebugMesh(
  center: { readonly x: number; readonly y: number; readonly z: number },
  radius: number,
  name: string,
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 24, 12);
  const material = createAimCollisionOutlineDebugMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(worldPointToThree(center));
  mesh.renderOrder = aimCollisionOutlineDebugRenderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

export function buildProtractorAngleLabelBoxDebugMesh(
  object: Extract<RuntimeWorldObject, { readonly kind: "protractor-angle" }>,
  name: string,
  material: THREE.Material,
  renderOrder: number,
): THREE.Mesh {
  const hitbox = object.labelHitbox ?? createProtractorAngleLabelHitbox({
    centerPoint: object.centerPoint,
    firstYawRadians: object.first.yawRadians,
    angleRadians: object.angleRadians,
    radiusMeters: object.radiusMeters,
  });
  const geometry = new THREE.BoxGeometry(hitbox.widthMeters, hitbox.heightMeters, hitbox.depthMeters);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(worldPointToThree(hitbox.center));
  mesh.rotation.y = hitbox.yawRadians;
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

export function buildGeodesicEmitterAimCollisionOutlineDebugMesh(
  object: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  bounds: SimpleCylinderBounds,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "aim-collision-outline:geodesic-emitter";
  group.renderOrder = aimCollisionOutlineDebugRenderOrder;
  group.frustumCulled = false;
  group.add(
    buildCylinderAimCollisionOutlineDebugMesh(bounds, "aim-collision-outline:geodesic-emitter-cylinder"),
    buildSphereAimCollisionOutlineDebugMesh(
      getGeodesicEmitterAimSphereCenter(object),
      bounds.radius,
      "aim-collision-outline:geodesic-emitter-top-sphere",
    ),
  );
  return group;
}

export function buildGeodesicSegmentSelectableHitboxDebugMesh(
  object: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "selectable-hitbox:geodesic-segment";
  group.renderOrder = selectableHitboxDebugRenderOrder;
  group.frustumCulled = false;

  const length = Math.max(0.001, object.lengthMeters);
  const segmentGeometry = new THREE.CylinderGeometry(
    geodesicSegmentAimRadiusMeters,
    geodesicSegmentAimRadiusMeters,
    length,
    20,
    1,
    true,
  );
  const material = createSelectableHitboxDebugMaterial(selectableGeodesicSegmentHitboxDebugColor);
  const segmentMesh = new THREE.Mesh(segmentGeometry, material);
  segmentMesh.name = "selectable-hitbox:geodesic-segment-body";
  segmentMesh.position.copy(worldPointToThree({
    x: object.start.x + object.direction.x * length * 0.5,
    y: object.start.y + object.direction.y * length * 0.5,
    z: object.start.z + object.direction.z * length * 0.5,
  }));
  const threeDirection = worldPointToThree(object.direction).normalize();
  segmentMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), threeDirection);
  segmentMesh.renderOrder = selectableHitboxDebugRenderOrder;
  segmentMesh.frustumCulled = false;
  group.add(segmentMesh);

  const capGeometry = new THREE.SphereGeometry(geodesicSegmentAimRadiusMeters, 16, 8);
  const startCap = new THREE.Mesh(capGeometry, material.clone());
  startCap.name = "selectable-hitbox:geodesic-segment-start-cap";
  startCap.position.copy(worldPointToThree(object.start));
  startCap.renderOrder = selectableHitboxDebugRenderOrder;
  startCap.frustumCulled = false;
  group.add(startCap);

  const endCap = new THREE.Mesh(capGeometry.clone(), material.clone());
  endCap.name = "selectable-hitbox:geodesic-segment-end-cap";
  endCap.position.copy(worldPointToThree({
    x: object.start.x + object.direction.x * length,
    y: object.start.y + object.direction.y * length,
    z: object.start.z + object.direction.z * length,
  }));
  endCap.renderOrder = selectableHitboxDebugRenderOrder;
  endCap.frustumCulled = false;
  group.add(endCap);

  return group;
}

export function buildGeodesicSegmentAimCollisionOutlineDebugMesh(
  object: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "aim-collision-outline:geodesic-segment";
  group.renderOrder = aimCollisionOutlineDebugRenderOrder;
  group.frustumCulled = false;

  const length = Math.max(0.001, object.lengthMeters);
  const segmentGeometry = new THREE.CylinderGeometry(
    geodesicSegmentAimRadiusMeters,
    geodesicSegmentAimRadiusMeters,
    length,
    20,
    1,
    true,
  );
  const material = createAimCollisionOutlineDebugMaterial();
  const segmentMesh = new THREE.Mesh(segmentGeometry, material);
  segmentMesh.name = "aim-collision-outline:geodesic-segment-body";
  segmentMesh.position.copy(worldPointToThree({
    x: object.start.x + object.direction.x * length * 0.5,
    y: object.start.y + object.direction.y * length * 0.5,
    z: object.start.z + object.direction.z * length * 0.5,
  }));
  const threeDirection = worldPointToThree(object.direction).normalize();
  segmentMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), threeDirection);
  segmentMesh.renderOrder = aimCollisionOutlineDebugRenderOrder;
  segmentMesh.frustumCulled = false;
  group.add(segmentMesh);

  const capGeometry = new THREE.SphereGeometry(geodesicSegmentAimRadiusMeters, 16, 8);
  const startCap = new THREE.Mesh(capGeometry, material.clone());
  startCap.name = "aim-collision-outline:geodesic-segment-start-cap";
  startCap.position.copy(worldPointToThree(object.start));
  startCap.renderOrder = aimCollisionOutlineDebugRenderOrder;
  startCap.frustumCulled = false;
  group.add(startCap);

  const endCap = new THREE.Mesh(capGeometry.clone(), material.clone());
  endCap.name = "aim-collision-outline:geodesic-segment-end-cap";
  endCap.position.copy(worldPointToThree({
    x: object.start.x + object.direction.x * length,
    y: object.start.y + object.direction.y * length,
    z: object.start.z + object.direction.z * length,
  }));
  endCap.renderOrder = aimCollisionOutlineDebugRenderOrder;
  endCap.frustumCulled = false;
  group.add(endCap);

  return group;
}

export function createSelectableHitboxDebugMaterial(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    depthWrite: false,
    opacity: selectableHitboxDebugOpacity,
    side: THREE.DoubleSide,
    transparent: true,
  });
}

export function createAimCollisionOutlineDebugMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: aimCollisionOutlineDebugColor,
    depthWrite: false,
    opacity: aimCollisionOutlineDebugOpacity,
    side: THREE.DoubleSide,
    transparent: true,
    wireframe: true,
  });
}

export const selectableObjectHitboxDebugColor = 0xffc400;
export const fallbackObjectAimCollisionRadiusMeters = 0.25;

export function buildSelectableHitboxDebugMesh(object: RuntimeWorldObject): THREE.Object3D | undefined {
  if (!object.tooltip && !object.interactable) {
    return undefined;
  }

  if (object.kind === "geodesic-segment") {
    return buildGeodesicSegmentSelectableHitboxDebugMesh(object);
  }

  if (object.kind === "protractor-angle") {
    return buildProtractorAngleLabelBoxDebugMesh(
      object,
      "selectable-hitbox:protractor-angle-label",
      createSelectableHitboxDebugMaterial(selectableObjectHitboxDebugColor),
      selectableHitboxDebugRenderOrder,
    );
  }

  const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
  return bounds ? buildCylinderSelectableHitboxDebugMesh(bounds, selectableObjectHitboxDebugColor) : undefined;
}

export function buildAimCollisionOutlineDebugMesh(object: RuntimeWorldObject): THREE.Object3D | undefined {
  if (!object.tooltip && !object.interactable) {
    return undefined;
  }

  if (object.kind === "geodesic-segment") {
    return buildGeodesicSegmentAimCollisionOutlineDebugMesh(object);
  }

  if (object.kind === "geodesic-cannon") {
    const bounds = getGeodesicEmitterAimCylinderBounds(object);
    return bounds ? buildGeodesicEmitterAimCollisionOutlineDebugMesh(object, bounds) : undefined;
  }

  if (object.kind === "protractor-angle") {
    return buildProtractorAngleLabelBoxDebugMesh(
      object,
      "aim-collision-outline:protractor-angle-label",
      createAimCollisionOutlineDebugMaterial(),
      aimCollisionOutlineDebugRenderOrder,
    );
  }

  const bounds = getDynamicObjectCollisionBounds(runtimeObjectToDynamicObjectState(object));
  if (bounds) {
    return buildCylinderAimCollisionOutlineDebugMesh(bounds, "aim-collision-outline:cylinder");
  }

  return buildSphereAimCollisionOutlineDebugMesh(
    object.localPose.translation,
    fallbackObjectAimCollisionRadiusMeters,
    "aim-collision-outline:fallback-sphere",
  );
}
