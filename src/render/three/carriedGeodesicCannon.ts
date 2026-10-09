/** Pure placement, glow, and naming helpers for carrying and aiming geodesic emitters. */
import * as THREE from "three";
import { type Vec3 } from "../../math/vec3";
import { geodesicRayBeamHeightMeters } from "../../world-objects/geodesicCannon";
import { type RuntimeWorldObject } from "../../world-objects/runtimeObjectRegistry";
import { RootAimRay } from "./rootAimRay";
import { threePointToWorld } from "./worldAxes";

export const carriedGeodesicEmitterDesktopDistanceMeters = 0.75;
export const carriedGeodesicEmitterPoseToleranceMeters = 1e-4;

export interface XrHeadWorldPose {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

export function resolveDesktopCarriedGeodesicCannonAnchor(
  cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  activeAimRay: RootAimRay | undefined,
): Vec3 | undefined {
  if (!activeAimRay) {
    return undefined;
  }

  const screenPoint = threePointToWorld(
    activeAimRay.origin.clone().add(
      activeAimRay.direction.clone().multiplyScalar(carriedGeodesicEmitterDesktopDistanceMeters),
    ),
  );
  return {
    x: screenPoint.x,
    y: screenPoint.y,
    z: cannon.localPose.translation.z,
  };
}

export function resolveVrCarriedGeodesicCannonAnchor(
  cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  activeAimRay: RootAimRay | undefined,
): Vec3 | undefined {
  if (!activeAimRay) {
    return undefined;
  }

  const handPoint = threePointToWorld(activeAimRay.origin);
  return {
    x: handPoint.x,
    y: handPoint.y,
    z: cannon.localPose.translation.z,
  };
}

export function createCarriedGeodesicCannonGlow(): THREE.Mesh {
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 1.72, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff7ac8,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glow.name = "carried-geodesic-emitter-glow";
  glow.renderOrder = 925;
  glow.visible = false;
  return glow;
}

export function resolveCannonGeodesicId(
  cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
  requestedGeodesicId: string | undefined,
): string | undefined {
  if (requestedGeodesicId && cannon.geodesicIds.includes(requestedGeodesicId)) {
    return requestedGeodesicId;
  }

  return cannon.activeGeodesicId ?? cannon.geodesicIds[0];
}

export function resolveGeodesicCannonAbsoluteEmitterPoint(
  cannon: Extract<RuntimeWorldObject, { readonly kind: "geodesic-cannon" }>,
): Vec3 {
  return {
    x: cannon.localPose.translation.x,
    y: cannon.localPose.translation.y,
    z: cannon.localPose.translation.z + geodesicRayBeamHeightMeters,
  };
}

export function getDistanceAlongGeodesicSegment(
  segment: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>,
  localPoint: Vec3,
): number {
  const dx = localPoint.x - segment.start.x;
  const dy = localPoint.y - segment.start.y;
  const dz = localPoint.z - segment.start.z;
  return dx * segment.direction.x + dy * segment.direction.y + dz * segment.direction.z;
}

export function formatGeodesicTerminal(terminal: Extract<RuntimeWorldObject, { readonly kind: "geodesic-segment" }>["terminal"]): string {
  switch (terminal.kind) {
    case "open":
      return "open";
    case "emitter-hit":
      return `emitter-hit:${terminal.emitterId}`;
    case "portal-hit":
      return `portal-hit:${terminal.portalId}->${terminal.targetCellId}:${terminal.targetPortalId}`;
    case "wall-hit":
      return `wall-hit:${terminal.sideIndex}`;
    case "forbidden-zone-hit":
      return `forbidden-zone-hit:${terminal.junctionId}`;
  }
}
