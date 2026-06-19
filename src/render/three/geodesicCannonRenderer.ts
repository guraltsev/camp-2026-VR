import * as THREE from "three";
import type { GeodesicCannonObject, GeodesicIntersectionObject, GeodesicSegmentObject } from "../../world-objects/geodesicCannon";
import { yawRigidTransform3 } from "../../math/rigidTransform3";
import { collectRuntimeObjectRenderSourceMeshes, type RuntimeObjectRenderRecord, type RuntimeObjectRenderSourceMesh } from "./runtimeObjectRenderRecords";
import type { PreparedWorldAssets } from "./preloadWorldAssets";
import { rigidTransformToThreeMatrix } from "./worldAxes";

export const geodesicSegmentArchetypeKey = "geodesic-segment:ribbon-cross";
export const geodesicSegmentConnectedArchetypeKey = "geodesic-segment:ribbon-cross:connected";
export const geodesicSegmentStraighteningArchetypeKey = "geodesic-segment:ribbon-cross:straightening";
export const geodesicSegmentTieDetachSelectedArchetypeKey = "geodesic-segment:ribbon-cross:tie-detach-selected";
export const geodesicRayPostArchetypePrefix = "geodesic-ray:post";
export const geodesicRayHeadArchetypePrefix = "geodesic-ray:head";
export const geodesicIntersectionArchetypePrefix = "geodesic-intersection:balloon";
export const geodesicRayAssetPaths = {
  post: "flashlight/Post.glb",
  lightsaber: "flashlight/Lightsaber.glb",
  balloon: "baloon/Balloon.glb",
} as const;
const geodesicRayAssetScale = 0.42;
const geodesicRayPostAssetFloorOffsetMeters = 0.74;
const geodesicIntersectionBalloonScale = 0.825;
export const geodesicRayEmitterPosition = { x: 0, y: 1.08, z: 0 } as const;

export function createGeodesicRuntimeRenderSources(
  assets?: PreparedWorldAssets,
): readonly RuntimeObjectRenderSourceMesh[] {
  return [
    createSegmentSource(),
    createSegmentSource({
      archetypeKey: geodesicSegmentConnectedArchetypeKey,
      color: 0xf6c445,
      opacity: 0.92,
    }),
    createSegmentSource({
      archetypeKey: geodesicSegmentStraighteningArchetypeKey,
      color: 0xf59e0b,
      opacity: 0.94,
    }),
    createSegmentSource({
      archetypeKey: geodesicSegmentTieDetachSelectedArchetypeKey,
      color: 0x22c55e,
      opacity: 0.98,
    }),
    ...createRayEmitterOnPostSources(assets),
    ...createIntersectionBalloonSources(assets),
  ];
}

export function getGeodesicRayArchetypeKeys(
  sources: readonly RuntimeObjectRenderSourceMesh[],
): readonly string[] {
  return sources
    .map((source) => source.archetypeKey)
    .filter((key) =>
      key.startsWith(`${geodesicRayPostArchetypePrefix}:`) ||
      key.startsWith(`${geodesicRayHeadArchetypePrefix}:`)
    );
}

export function collectGeodesicRuntimeRenderRecords(
  object: GeodesicCannonObject | GeodesicSegmentObject | GeodesicIntersectionObject,
  geodesicArchetypeKeys: readonly string[] = [],
): readonly RuntimeObjectRenderRecord[] {
  if (object.kind === "geodesic-cannon") {
    const localMatrix = rigidTransformToThreeMatrix(object.localPose);
    const postRecords = geodesicArchetypeKeys
      .filter((key) => key.startsWith(`${geodesicRayPostArchetypePrefix}:`))
      .map((archetypeKey) => ({
        objectId: object.id,
        cellId: object.cellId,
        archetypeKey,
        localMatrix,
      }));
    const headKeys = geodesicArchetypeKeys.filter((key) => key.startsWith(`${geodesicRayHeadArchetypePrefix}:`));
    const geodesicIds = object.geodesicIds.length > 0
      ? object.geodesicIds
      : object.activeGeodesicId
        ? [object.activeGeodesicId]
        : [];
    const headRecords = geodesicIds.flatMap((geodesicId) => headKeys.map((archetypeKey) => ({
      objectId: `${object.id}:${geodesicId}:head`,
      cellId: object.cellId,
      archetypeKey,
      localMatrix: composeEmitterYawMatrix(object, geodesicId),
    })));
    return [...postRecords, ...headRecords];
  }

  if (object.kind === "geodesic-intersection") {
    return geodesicArchetypeKeys
      .filter((key) => key.startsWith(`${geodesicIntersectionArchetypePrefix}:`))
      .map((archetypeKey) => ({
        objectId: object.id,
        cellId: object.cellId,
        archetypeKey,
        localMatrix: rigidTransformToThreeMatrix(object.localPose),
      }));
  }

  return [
    {
      objectId: object.id,
      cellId: object.cellId,
      archetypeKey: object.highlightState === "tie-detach-selected"
        ? geodesicSegmentTieDetachSelectedArchetypeKey
        : object.connectionState === "straightening"
        ? geodesicSegmentStraighteningArchetypeKey
        : object.connectionState === "connected"
          ? geodesicSegmentConnectedArchetypeKey
          : geodesicSegmentArchetypeKey,
      localMatrix: composeSegmentMatrix(object),
    },
  ];
}

function composeEmitterYawMatrix(cannon: GeodesicCannonObject, geodesicId: string): THREE.Matrix4 {
  const yawRadians = cannon.geodesicEmitterYawRadiansById?.[geodesicId] ?? cannon.aimYawRadians;
  return rigidTransformToThreeMatrix(yawRigidTransform3(yawRadians, cannon.localPose.translation));
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

function createSegmentSource(options: {
  readonly archetypeKey?: string;
  readonly color?: number;
  readonly opacity?: number;
} = {}): RuntimeObjectRenderSourceMesh {
  const segmentMaterial = new THREE.MeshBasicMaterial({
    color: options.color ?? 0x38f2ff,
    transparent: true,
    opacity: options.opacity ?? 0.88,
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
    archetypeKey: options.archetypeKey ?? geodesicSegmentArchetypeKey,
    mesh: segment,
    root,
  };
}

function createRayEmitterOnPostSources(
  assets: PreparedWorldAssets | undefined,
): readonly RuntimeObjectRenderSourceMesh[] {
  const postRoot = new THREE.Group();
  postRoot.name = "geodesic-ray-post-source";
  const headRoot = new THREE.Group();
  headRoot.name = "geodesic-ray-head-source";

  const preparedPost = assets?.instantiateGltf(geodesicRayAssetPaths.post)?.scene;
  const post = preparedPost ?? createFallbackPost();
  post.name = "asset:geodesic-ray-post";
  post.scale.setScalar(geodesicRayAssetScale);
  if (preparedPost) {
    post.position.y = geodesicRayPostAssetFloorOffsetMeters;
  }
  postRoot.add(post);

  const lightsaber = assets?.instantiateGltf(geodesicRayAssetPaths.lightsaber)?.scene ?? createFallbackLightsaber();
  lightsaber.name = "asset:geodesic-ray-lightsaber";
  lightsaber.scale.setScalar(geodesicRayAssetScale);
  lightsaber.position.set(
    geodesicRayEmitterPosition.x,
    geodesicRayEmitterPosition.y,
    geodesicRayEmitterPosition.z,
  );
  headRoot.add(lightsaber);

  postRoot.updateMatrixWorld(true);
  headRoot.updateMatrixWorld(true);

  return [
    ...collectRuntimeObjectRenderSourceMeshes(
      "geodesic-ray:post-source",
      postRoot,
      geodesicRayPostArchetypePrefix,
    ),
    ...collectRuntimeObjectRenderSourceMeshes(
      "geodesic-ray:head-source",
      headRoot,
      geodesicRayHeadArchetypePrefix,
    ),
  ];
}

function createIntersectionBalloonSources(
  assets: PreparedWorldAssets | undefined,
): readonly RuntimeObjectRenderSourceMesh[] {
  const root = new THREE.Group();
  root.name = "geodesic-intersection-balloon-source";
  const balloon = assets?.instantiateGltf(geodesicRayAssetPaths.balloon)?.scene ?? createFallbackBalloon();
  balloon.name = "asset:geodesic-intersection-balloon";
  balloon.scale.setScalar(geodesicIntersectionBalloonScale);
  root.add(balloon);
  root.updateMatrixWorld(true);

  return collectRuntimeObjectRenderSourceMeshes(
    "geodesic-intersection:balloon-source",
    root,
    geodesicIntersectionArchetypePrefix,
  );
}

function createFallbackBalloon(): THREE.Object3D {
  const root = new THREE.Group();
  const balloon = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xff4d8d, roughness: 0.42, metalness: 0.02 }),
  );
  balloon.scale.y = 1.25;
  balloon.position.y = 0.3;
  const knot = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0xd61f69, roughness: 0.5 }),
  );
  knot.position.y = 0.02;
  knot.rotation.x = Math.PI;
  root.add(balloon, knot);
  return root;
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

function createFallbackLightsaber(): THREE.Object3D {
  const root = new THREE.Group();
  const hilt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.22, 18),
    new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.38, metalness: 0.42 }),
  );
  hilt.rotation.z = Math.PI / 2;
  hilt.position.x = 0.04;
  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.42, 18),
    new THREE.MeshStandardMaterial({ color: 0x38f2ff, emissive: 0x0e7490, roughness: 0.18 }),
  );
  blade.rotation.z = Math.PI / 2;
  blade.position.x = 0.34;
  root.add(hilt, blade);
  return root;
}
