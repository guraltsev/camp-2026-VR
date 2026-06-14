import * as THREE from "three";
import type { GeodesicCannonObject, GeodesicSegmentObject } from "../../world-objects/geodesicCannon";
import { collectRuntimeObjectRenderSourceMeshes, type RuntimeObjectRenderRecord, type RuntimeObjectRenderSourceMesh } from "./runtimeObjectRenderRecords";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
import { rigidTransformToThreeMatrix } from "./worldAxes";

export const geodesicSegmentArchetypeKey = "geodesic-segment:ribbon-cross";
export const geodesicFlashlightPostArchetypePrefix = "geodesic-flashlight:post";
export const geodesicFlashlightHeadArchetypePrefix = "geodesic-flashlight:head";
export const geodesicFlashlightAssetPaths = {
  post: "flashlight/Post.glb",
  flashlight: "flashlight/Flashlight.glb",
} as const;

export function createGeodesicRuntimeRenderSources(
  assets?: PreparedWorldAssets,
): readonly RuntimeObjectRenderSourceMesh[] {
  return [
    createSegmentSource(),
    ...createFlashlightOnPostSources(assets),
  ];
}

export function getGeodesicFlashlightArchetypeKeys(
  sources: readonly RuntimeObjectRenderSourceMesh[],
): readonly string[] {
  return sources
    .map((source) => source.archetypeKey)
    .filter((key) =>
      key.startsWith(`${geodesicFlashlightPostArchetypePrefix}:`) ||
      key.startsWith(`${geodesicFlashlightHeadArchetypePrefix}:`)
    );
}

export function collectGeodesicRuntimeRenderRecords(
  object: GeodesicCannonObject | GeodesicSegmentObject,
  flashlightArchetypeKeys: readonly string[] = [],
): readonly RuntimeObjectRenderRecord[] {
  if (object.kind === "geodesic-cannon") {
    const localMatrix = rigidTransformToThreeMatrix(object.localPose);
    return flashlightArchetypeKeys.map((archetypeKey) => ({
      objectId: object.id,
      cellId: object.cellId,
      archetypeKey,
      localMatrix,
    }));
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

function createSegmentSource(): RuntimeObjectRenderSourceMesh {
  const segmentMaterial = new THREE.MeshBasicMaterial({
    color: 0x38f2ff,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const segment = new THREE.Mesh(createCrossRibbonGeometry(0.025), segmentMaterial);
  segment.name = "geodesic-segment-ribbon-cross";
  const root = new THREE.Group();
  root.name = "geodesic-segment-runtime-render-source";
  root.add(segment);
  root.updateMatrixWorld(true);

  return {
    objectId: "geodesic-segment:source",
    archetypeKey: geodesicSegmentArchetypeKey,
    mesh: segment,
    root,
  };
}

function createFlashlightOnPostSources(
  assets: PreparedWorldAssets | undefined,
): readonly RuntimeObjectRenderSourceMesh[] {
  const postRoot = new THREE.Group();
  postRoot.name = "geodesic-flashlight-post-source";
  const headRoot = new THREE.Group();
  headRoot.name = "geodesic-flashlight-head-source";

  const post = assets?.instantiateGltf(geodesicFlashlightAssetPaths.post)?.scene ?? createFallbackPost();
  post.name = "asset:geodesic-flashlight-post";
  post.scale.setScalar(0.42);
  postRoot.add(post);

  const flashlight = assets?.instantiateGltf(geodesicFlashlightAssetPaths.flashlight)?.scene ?? createFallbackFlashlight();
  flashlight.name = "asset:geodesic-flashlight-head";
  flashlight.scale.setScalar(0.42);
  flashlight.position.set(0.18, 0.92, 0);
  headRoot.add(flashlight);

  postRoot.updateMatrixWorld(true);
  headRoot.updateMatrixWorld(true);

  return [
    ...collectRuntimeObjectRenderSourceMeshes(
      "geodesic-flashlight:post-source",
      postRoot,
      geodesicFlashlightPostArchetypePrefix,
    ),
    ...collectRuntimeObjectRenderSourceMeshes(
      "geodesic-flashlight:head-source",
      headRoot,
      geodesicFlashlightHeadArchetypePrefix,
    ),
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

function createFallbackPost(): THREE.Object3D {
  const root = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 1.55, 14),
    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.8, metalness: 0.18 }),
  );
  pole.position.y = 0.775;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.08, 18),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.72, metalness: 0.14 }),
  );
  base.position.y = 0.04;
  root.add(base, pole);
  return root;
}

function createFallbackFlashlight(): THREE.Object3D {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.32, 18),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.35 }),
  );
  body.rotation.z = Math.PI / 2;
  body.position.x = 0.08;
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.035, 18),
    new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0e7490, roughness: 0.22 }),
  );
  lens.rotation.z = Math.PI / 2;
  lens.position.x = 0.26;
  root.add(body, lens);
  return root;
}
