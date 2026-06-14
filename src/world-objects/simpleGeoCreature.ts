import * as THREE from "three";
import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CompiledPrismCell } from "../cell-complex/prismCells";
import type { CellObjectSpec, SimpleGeoCreatureObjectSpec } from "../cell-complex/specs";
import { yawRigidTransform3, transformDirection3, type RigidTransform3 } from "../math/rigidTransform3";
import { vec3 } from "../math/vec3";
import { getDynamicObjectCollisionBounds } from "../movement/collision";
import type { DynamicObjectState } from "../movement/dynamicObject";
import {
  AUTONOMOUS_DYNAMIC_OBJECT_PORTAL_CROSSING_MODE,
  moveDynamicObject,
} from "../movement/moveDynamicObject";
import { runtimeDiagnostics } from "../render/three/runtimeDiagnostics";
import {
  buildObjectCollisionWireframe,
  updateObjectCollisionWireframe,
} from "../render/three/debugCollisionWireframes";
import type { PreparedWorldAssets } from "../render/three/preloadWorldAssets";
import { applyWorldRigidTransform } from "../render/three/worldAxes";
import { degreesToRadians } from "./staticAssets";
import type { RuntimeObjectRegistry } from "./runtimeObjectRegistry";
import { runtimeObjectToDynamicObjectState, type RuntimeCreatureObject } from "./runtimeObjectRegistry";

export interface SimpleGeoCreatureAuthoringParams {
  readonly position: readonly [x: number, y: number, z: number];
  readonly scale?: number;
  readonly forwardTilt?: number;
  readonly sideTilt?: number;
  readonly turn?: number;
  readonly speed?: number;
  readonly oscillationRate?: number;
  readonly oscillationMagnitude?: number;
}

export interface SimpleGeoCreatureRuntime {
  readonly root: THREE.Object3D;
  readonly objectId: string;
  readonly cellId: string;
  update(world: CompiledCellComplex, deltaSeconds: number): void;
  syncParent(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
  setCollisionWireframeVisible(visible: boolean): void;
  reset(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
}

const defaultScale = 1;
const collisionFloorClearanceMeters = 0.01;
const tau = Math.PI * 2;
const butterflyVerticalRateBucketSeconds = 0.1;
const butterflyVerticalRateMinHz = 0.85;
const butterflyVerticalRateMaxHz = 2;
const butterflyVerticalRateMinMultiplier = 1.31;
const butterflyVerticalRateMaxMultiplier = 1.73;
const butterflyVerticalMagnitudeFractionOfHeight = 0.1;
const butterflyVerticalMagnitudeMaxMeters = 0.08;
const forbiddenZoneLateralStopClearanceMeters = 0.5;
const forbiddenZoneLateralFadeMeters = 0.5;
const mouseAssetBounds = {
  widthMetersAtAuthorScale: 19.218719482421875 / 30,
  heightMetersAtAuthorScale: 31.855297088623047 / 30,
} as const;
const mouseBodyCollision = {
  lengthMetersAtAuthorScale: 1.45,
  centerYMetersAtAuthorScale: 0.35,
} as const;
const butterflyAssetBounds = {
  widthMetersAtAuthorScale: 1.5509990453720093 * 0.8,
  lengthMetersAtAuthorScale: 1.0916100144386292 * 0.8,
  heightMetersAtAuthorScale: 0.92323899269104 * 0.8,
  centerXMetersAtAuthorScale: 0.016376495361328125 * 0.8,
  centerYMetersAtAuthorScale: 0.045488983392715454 * 0.8,
} as const;

export function createSimpleGeoCreature(
  kind: SimpleGeoCreatureObjectSpec["kind"],
  id: string,
  assetPath: string,
  params: SimpleGeoCreatureAuthoringParams,
): SimpleGeoCreatureObjectSpec {
  const authorScale = params.scale ?? defaultScale;

  return {
    id,
    kind,
    assetPath,
    position: {
      x: params.position[0],
      y: params.position[2],
      z: params.position[1],
    },
    modelOffset: {
      x: 0,
      y: 0,
      z: creatureModelLiftMeters(kind, authorScale),
    },
    scale: authorScale * defaultVisualScale(kind),
    forwardTiltRadians: degreesToRadians(params.forwardTilt ?? 0),
    sideTiltRadians: degreesToRadians(params.sideTilt ?? 0),
    turnRadians: degreesToRadians(params.turn ?? 0),
    yawRadians: degreesToRadians(params.turn ?? 0),
    speedMetersPerSecond: params.speed ?? defaultSpeed(kind),
    oscillationRateHz: params.oscillationRate ?? 0,
    oscillationMagnitudeMeters: params.oscillationMagnitude ?? 0,
    collision: defaultCreatureCollision(kind, authorScale),
  };
}

export function isSimpleGeoCreatureObjectSpec(objectSpec: CellObjectSpec): objectSpec is SimpleGeoCreatureObjectSpec {
  return objectSpec.kind === "geo-mouse" || objectSpec.kind === "geo-butterfly";
}

export function createSimpleGeoCreatureRuntime(
  objectSpec: SimpleGeoCreatureObjectSpec,
  startCellId: string,
  assets: PreparedWorldAssets,
  registry?: RuntimeObjectRegistry,
): SimpleGeoCreatureRuntime {
  const root = new THREE.Group();
  root.name = `${objectSpec.kind}:${objectSpec.id}`;

  const prepared = assets.instantiateGltf(objectSpec.assetPath);
  if (!prepared) {
    throw new Error(`Geo creature asset was not preloaded: ${objectSpec.assetPath}`);
  }

  prepared.scene.name = `asset:${objectSpec.id}`;
  prepared.scene.scale.setScalar(objectSpec.scale ?? defaultScale);
  prepared.scene.rotation.x = objectSpec.forwardTiltRadians ?? 0;
  prepared.scene.rotation.y = Math.PI;
  prepared.scene.rotation.z = objectSpec.sideTiltRadians ?? 0;
  if (objectSpec.modelOffset) {
    prepared.scene.position.copy(new THREE.Vector3(objectSpec.modelOffset.x, objectSpec.modelOffset.z, -objectSpec.modelOffset.y));
  }
  root.add(prepared.scene);
  const initialObject = createRuntimeCreatureObject(objectSpec, startCellId);
  registry?.add(initialObject);
  const initialState = runtimeObjectToDynamicObjectState(initialObject);
  let state = initialState;
  const collisionWireframe = buildObjectCollisionWireframe(objectSpec.id, state);
  collisionWireframe.visible = false;
  root.add(collisionWireframe);
  let elapsedSeconds = 0;
  let lateralOscillationOffsetMeters = 0;
  let verticalOscillationPhaseRadians = initialButterflyVerticalOscillationPhaseRadians(objectSpec);
  let verticalOscillationOffsetMeters = butterflyVerticalOscillationHeightOffset(objectSpec, verticalOscillationPhaseRadians);
  const diagnostics = runtimeDiagnostics();

  diagnostics.recordAssetInstanceStart(startCellId, objectSpec.id, objectSpec.assetPath, objectSpec.kind);
  diagnostics.recordAssetInstanceComplete(startCellId, objectSpec.id, objectSpec.assetPath, objectSpec.kind);
  applyObjectPose(root, state.localPose);

  return {
    root,
    objectId: objectSpec.id,
    get cellId() {
      return state.cellId;
    },
    update(world, deltaSeconds) {
      if (deltaSeconds <= 0) {
        return;
      }

      elapsedSeconds += deltaSeconds;
      const forward = objectSpec.speedMetersPerSecond * deltaSeconds;
      const cell = world.cellsById.get(state.cellId);
      const nextLateralOscillationOffsetMeters = lateralOscillationOffset(objectSpec, elapsedSeconds);
      const lateralOffsetDeltaMeters = (nextLateralOscillationOffsetMeters - lateralOscillationOffsetMeters) *
        (cell ? forbiddenZoneLateralOscillationScale(cell, state) : 1);
      lateralOscillationOffsetMeters = nextLateralOscillationOffsetMeters;
      verticalOscillationPhaseRadians += butterflyVerticalOscillationRateHz(objectSpec, elapsedSeconds) * tau * deltaSeconds;
      const nextVerticalOscillationOffsetMeters = butterflyVerticalOscillationHeightOffset(
        objectSpec,
        verticalOscillationPhaseRadians,
      );
      const verticalOffsetDeltaMeters = nextVerticalOscillationOffsetMeters - verticalOscillationOffsetMeters;
      verticalOscillationOffsetMeters = nextVerticalOscillationOffsetMeters;
      const displacement = transformDirection3(state.localPose, vec3(lateralOffsetDeltaMeters, forward, verticalOffsetDeltaMeters));
      const result = moveDynamicObject({
        world,
        object: state,
        displacement,
        portalCrossingMode: AUTONOMOUS_DYNAMIC_OBJECT_PORTAL_CROSSING_MODE,
        ignoreForbiddenZones: true,
      });
      state = result.object;
      syncRegistryObject(registry, objectSpec.id, result.object);
      applyObjectPose(root, state.localPose);
      updateObjectCollisionWireframe(collisionWireframe, state);
    },
    syncParent(cellRoots) {
      const targetRoot = cellRoots.get(state.cellId);

      if (targetRoot && root.parent !== targetRoot) {
        targetRoot.add(root);
      }
    },
    setCollisionWireframeVisible(visible) {
      collisionWireframe.visible = visible;
    },
    reset(cellRoots) {
      elapsedSeconds = 0;
      lateralOscillationOffsetMeters = 0;
      verticalOscillationPhaseRadians = initialButterflyVerticalOscillationPhaseRadians(objectSpec);
      verticalOscillationOffsetMeters = butterflyVerticalOscillationHeightOffset(
        objectSpec,
        verticalOscillationPhaseRadians,
      );
      state = initialState;
      syncRegistryObject(registry, objectSpec.id, state);
      applyObjectPose(root, state.localPose);
      updateObjectCollisionWireframe(collisionWireframe, state);
      const targetRoot = cellRoots.get(state.cellId);

      if (targetRoot && root.parent !== targetRoot) {
        targetRoot.add(root);
      }
    },
  };
}

export function createSimpleGeoCreatureRuntimeObject(
  objectSpec: SimpleGeoCreatureObjectSpec,
  cellId: string,
): RuntimeCreatureObject {
  return createRuntimeCreatureObject(objectSpec, cellId);
}

function createRuntimeCreatureObject(objectSpec: SimpleGeoCreatureObjectSpec, cellId: string): RuntimeCreatureObject {
  return {
    id: objectSpec.id,
    kind: objectSpec.kind,
    cellId,
    localPose: yawRigidTransform3(
      objectSpec.turnRadians ?? 0,
      vec3(objectSpec.position.x, objectSpec.position.y, objectSpec.position.z),
    ),
    collision: objectSpec.collision,
    portalRenderable: true,
    tooltip: {
      label: objectSpec.kind === "geo-mouse" ? "geodesic mouse" : "geodesic butterfly",
      rangeMeters: 2.25,
    },
  };
}

function syncRegistryObject(
  registry: RuntimeObjectRegistry | undefined,
  id: string,
  state: DynamicObjectState,
): void {
  if (!registry) {
    return;
  }

  const object = registry.get(id);
  if (!object || (object.kind !== "geo-mouse" && object.kind !== "geo-butterfly")) {
    return;
  }

  registry.update({
    ...object,
    cellId: state.cellId,
    localPose: state.localPose,
    collision: state.collision,
  });
}

function lateralOscillationOffset(objectSpec: SimpleGeoCreatureObjectSpec, elapsedSeconds: number): number {
  if (objectSpec.oscillationRateHz <= 0 || objectSpec.oscillationMagnitudeMeters <= 0) {
    return 0;
  }

  return Math.sin(elapsedSeconds * objectSpec.oscillationRateHz * tau) * objectSpec.oscillationMagnitudeMeters;
}

export function forbiddenZoneLateralOscillationScale(
  cell: CompiledPrismCell,
  state: DynamicObjectState,
): number {
  const bounds = getDynamicObjectCollisionBounds(state);

  if (!bounds || cell.singularityColumns.length === 0) {
    return 1;
  }

  let nearestClearanceMeters = Infinity;

  for (const exclusionCylinder of cell.singularityColumns) {
    const dx = bounds.center.x - exclusionCylinder.center.x;
    const dy = bounds.center.y - exclusionCylinder.center.y;
    const clearanceMeters = Math.sqrt(dx * dx + dy * dy) - bounds.radius - exclusionCylinder.radius;
    nearestClearanceMeters = Math.min(nearestClearanceMeters, clearanceMeters);
  }

  const fadeStartMeters = forbiddenZoneLateralStopClearanceMeters;
  const fadeEndMeters = fadeStartMeters + forbiddenZoneLateralFadeMeters;
  const t = clamp((nearestClearanceMeters - fadeStartMeters) / (fadeEndMeters - fadeStartMeters), 0, 1);

  return t * t * (3 - 2 * t);
}

export function butterflyVerticalOscillationRateHz(
  objectSpec: SimpleGeoCreatureObjectSpec,
  elapsedSeconds: number,
): number {
  if (objectSpec.kind !== "geo-butterfly") {
    return 0;
  }

  const lateralRateHz = objectSpec.oscillationRateHz > 0 ? objectSpec.oscillationRateHz : 1;
  const minRateHz = clamp(
    lateralRateHz * butterflyVerticalRateMinMultiplier,
    butterflyVerticalRateMinHz,
    butterflyVerticalRateMaxHz,
  );
  const maxRateHz = clamp(
    lateralRateHz * butterflyVerticalRateMaxMultiplier,
    minRateHz,
    butterflyVerticalRateMaxHz,
  );
  const bucket = Math.floor(Math.max(0, elapsedSeconds) / butterflyVerticalRateBucketSeconds);
  const random = seededUnitInterval(`${objectSpec.id}:vertical-rate:${bucket}`);

  return minRateHz + (maxRateHz - minRateHz) * random;
}

export function butterflyVerticalOscillationHeightMagnitudeMeters(objectSpec: SimpleGeoCreatureObjectSpec): number {
  if (objectSpec.kind !== "geo-butterfly") {
    return 0;
  }

  return Math.min(
    objectSpec.collision.height * butterflyVerticalMagnitudeFractionOfHeight,
    butterflyVerticalMagnitudeMaxMeters,
  );
}

function initialButterflyVerticalOscillationPhaseRadians(objectSpec: SimpleGeoCreatureObjectSpec): number {
  if (objectSpec.kind !== "geo-butterfly") {
    return 0;
  }

  return seededUnitInterval(`${objectSpec.id}:vertical-phase`) * tau;
}

function butterflyVerticalOscillationHeightOffset(
  objectSpec: SimpleGeoCreatureObjectSpec,
  phaseRadians: number,
): number {
  return Math.sin(phaseRadians) * butterflyVerticalOscillationHeightMagnitudeMeters(objectSpec);
}

function seededUnitInterval(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0x100000000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function defaultSpeed(kind: SimpleGeoCreatureObjectSpec["kind"]): number {
  return kind === "geo-butterfly" ? 0.7 : 1.2;
}

function defaultVisualScale(kind: SimpleGeoCreatureObjectSpec["kind"]): number {
  return kind === "geo-mouse" ? 1 / 30 : 0.8;
}

function creatureModelLiftMeters(kind: SimpleGeoCreatureObjectSpec["kind"], authorScale: number): number {
  return kind === "geo-butterfly" ? authorScale * 0.25 : authorScale * 0.35;
}

function defaultCreatureCollision(
  kind: SimpleGeoCreatureObjectSpec["kind"],
  authorScale: number,
): SimpleGeoCreatureObjectSpec["collision"] {
  if (kind === "geo-butterfly") {
    const height = butterflyAssetBounds.heightMetersAtAuthorScale * authorScale;

    return {
      radius: Math.max(
        butterflyAssetBounds.widthMetersAtAuthorScale,
        butterflyAssetBounds.lengthMetersAtAuthorScale,
      ) * authorScale / 2,
      height,
      offset: {
        x: butterflyAssetBounds.centerXMetersAtAuthorScale * authorScale,
        y: butterflyAssetBounds.centerYMetersAtAuthorScale * authorScale,
        z: Math.max(creatureModelLiftMeters(kind, authorScale), height / 2 + collisionFloorClearanceMeters),
      },
    };
  }

  const height = mouseAssetBounds.heightMetersAtAuthorScale * authorScale;

  return {
    radius: Math.max(
      mouseAssetBounds.widthMetersAtAuthorScale,
      mouseBodyCollision.lengthMetersAtAuthorScale,
    ) * authorScale / 2,
    height,
    offset: {
      x: 0,
      y: mouseBodyCollision.centerYMetersAtAuthorScale * authorScale,
      z: Math.max(creatureModelLiftMeters(kind, authorScale), height / 2 + collisionFloorClearanceMeters),
    },
  };
}

function applyObjectPose(root: THREE.Object3D, pose: RigidTransform3): void {
  applyWorldRigidTransform(root, pose);
}
