import * as THREE from "three";
import type { GeodesicCannonObject, GeodesicSegmentObject } from "../../world-objects/geodesicCannon";
import type { RuntimeObjectRenderRecord, RuntimeObjectRenderSourceMesh } from "./runtimeObjectRenderRecords";
import { rigidTransformToThreeMatrix } from "./worldAxes";

export const geodesicSegmentArchetypeKey = "geodesic-segment:ribbon-cross";
export const geodesicCannonBaseArchetypeKey = "geodesic-cannon:base";
export const geodesicCannonBarrelArchetypeKey = "geodesic-cannon:barrel";

export function createGeodesicRuntimeRenderSources(): readonly RuntimeObjectRenderSourceMesh[] {
  const root = new THREE.Group();
  root.name = "geodesic-runtime-render-sources";

  const segmentMaterial = new THREE.MeshBasicMaterial({
    color: 0x38f2ff,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const segment = new THREE.Mesh(createCrossRibbonGeometry(0.025), segmentMaterial);
  segment.name = "geodesic-segment-ribbon-cross";
  const segmentSourceRoot = new THREE.Group();
  segmentSourceRoot.add(segment);
  root.add(segmentSourceRoot);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.16, 18),
    new THREE.MeshStandardMaterial({ color: 0x243241, roughness: 0.72, metalness: 0.12 }),
  );
  base.name = "geodesic-cannon-base";
  base.rotation.x = Math.PI / 2;
  base.position.z = 0.08;

  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.58, metalness: 0.18 }),
  );
  barrel.name = "geodesic-cannon-barrel";
  barrel.position.set(0.22, 0, 0.28);

  root.updateMatrixWorld(true);
  segmentSourceRoot.updateMatrixWorld(true);

  return [
    {
      objectId: "geodesic-segment:source",
      archetypeKey: geodesicSegmentArchetypeKey,
      mesh: segment,
      root: segmentSourceRoot,
    },
    {
      objectId: "geodesic-cannon:source",
      archetypeKey: geodesicCannonBaseArchetypeKey,
      mesh: base,
      root,
    },
    {
      objectId: "geodesic-cannon:source",
      archetypeKey: geodesicCannonBarrelArchetypeKey,
      mesh: barrel,
      root,
    },
  ];
}

function createCrossRibbonGeometry(width: number): THREE.BufferGeometry {
  const half = width / 2;
  const positions = new Float32Array([
    0, -half, 0, 1, -half, 0, 1, half, 0, 0, half, 0,
    0, 0, -half, 1, 0, -half, 1, 0, half, 0, 0, half,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function collectGeodesicRuntimeRenderRecords(
  object: GeodesicCannonObject | GeodesicSegmentObject,
): readonly RuntimeObjectRenderRecord[] {
  if (object.kind === "geodesic-cannon") {
    const localMatrix = rigidTransformToThreeMatrix(object.localPose);
    return [
      {
        objectId: object.id,
        cellId: object.cellId,
        archetypeKey: geodesicCannonBaseArchetypeKey,
        localMatrix,
      },
      {
        objectId: object.id,
        cellId: object.cellId,
        archetypeKey: geodesicCannonBarrelArchetypeKey,
        localMatrix,
      },
    ];
  }

  return [
    {
      objectId: object.id,
      cellId: object.cellId,
      archetypeKey: geodesicSegmentArchetypeKey,
      localMatrix: composeSegmentMatrix(object),
    },
  ];
}

export function composeSegmentMatrix(segment: GeodesicSegmentObject): THREE.Matrix4 {
  const yaw = Math.atan2(segment.direction.y, segment.direction.x);
  return rigidTransformToThreeMatrix({
    rotation: {
      m00: Math.cos(yaw),
      m01: -Math.sin(yaw),
      m02: 0,
      m10: Math.sin(yaw),
      m11: Math.cos(yaw),
      m12: 0,
      m20: 0,
      m21: 0,
      m22: 1,
    },
    translation: segment.start,
  }).multiply(new THREE.Matrix4().makeScale(segment.lengthMeters, 1, 1));
}
