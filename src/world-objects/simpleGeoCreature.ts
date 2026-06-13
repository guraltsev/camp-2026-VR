import * as THREE from "three";
import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CellObjectSpec, SimpleGeoCreatureObjectSpec } from "../cell-complex/specs";
import { yawRigidTransform3, transformDirection3, type RigidTransform3 } from "../math/rigidTransform3";
import { vec3 } from "../math/vec3";
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
  readonly cellId: string;
  update(world: CompiledCellComplex, deltaSeconds: number): void;
  syncParent(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
  setCollisionWireframeVisible(visible: boolean): void;
  reset(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
}

const defaultScale = 1;
const collisionFloorClearanceMeters = 0.01;
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
    oscillationMagnitudeMeters: (params.oscillationMagnitude ?? 0) / 10,
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
  const initialState = createDynamicObjectState(objectSpec, startCellId);
  let state = initialState;
  const collisionWireframe = buildObjectCollisionWireframe(objectSpec.id, state);
  collisionWireframe.visible = false;
  root.add(collisionWireframe);
  let elapsedSeconds = 0;
  const diagnostics = runtimeDiagnostics();

  diagnostics.recordAssetInstanceStart(startCellId, objectSpec.id, objectSpec.assetPath, objectSpec.kind);
  diagnostics.recordAssetInstanceComplete(startCellId, objectSpec.id, objectSpec.assetPath, objectSpec.kind);
  applyObjectPose(root, state.localPose);

  return {
    root,
    get cellId() {
      return state.cellId;
    },
    update(world, deltaSeconds) {
      if (deltaSeconds <= 0) {
        return;
      }

      elapsedSeconds += deltaSeconds;
      const forward = objectSpec.speedMetersPerSecond * deltaSeconds;
      const lateralOffsetMeters = lateralOscillationOffset(objectSpec, elapsedSeconds);
      const displacement = transformDirection3(state.localPose, vec3(lateralOffsetMeters, forward, 0));
      const result = moveDynamicObject({
        world,
        object: state,
        displacement,
        portalCrossingMode: AUTONOMOUS_DYNAMIC_OBJECT_PORTAL_CROSSING_MODE,
      });
      state = result.object;
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
      state = initialState;
      applyObjectPose(root, state.localPose);
      updateObjectCollisionWireframe(collisionWireframe, state);
      const targetRoot = cellRoots.get(state.cellId);

      if (targetRoot && root.parent !== targetRoot) {
        targetRoot.add(root);
      }
    },
  };
}

function createDynamicObjectState(objectSpec: SimpleGeoCreatureObjectSpec, cellId: string): DynamicObjectState {
  return {
    cellId,
    localPose: yawRigidTransform3(
      objectSpec.turnRadians ?? 0,
      vec3(objectSpec.position.x, objectSpec.position.y, objectSpec.position.z),
    ),
    collision: objectSpec.collision,
  };
}

function lateralOscillationOffset(objectSpec: SimpleGeoCreatureObjectSpec, elapsedSeconds: number): number {
  if (objectSpec.oscillationRateHz <= 0 || objectSpec.oscillationMagnitudeMeters <= 0) {
    return 0;
  }

  return Math.sin(elapsedSeconds * objectSpec.oscillationRateHz * Math.PI * 2) * objectSpec.oscillationMagnitudeMeters;
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
    const dz = butterflyAssetBounds.heightMetersAtAuthorScale * authorScale;

    return {
      dx: butterflyAssetBounds.widthMetersAtAuthorScale * authorScale,
      dy: butterflyAssetBounds.lengthMetersAtAuthorScale * authorScale,
      dz,
      offset: {
        x: butterflyAssetBounds.centerXMetersAtAuthorScale * authorScale,
        y: butterflyAssetBounds.centerYMetersAtAuthorScale * authorScale,
        z: Math.max(creatureModelLiftMeters(kind, authorScale), dz / 2 + collisionFloorClearanceMeters),
      },
    };
  }

  const dz = mouseAssetBounds.heightMetersAtAuthorScale * authorScale;

  return {
    dx: mouseAssetBounds.widthMetersAtAuthorScale * authorScale,
    dy: mouseBodyCollision.lengthMetersAtAuthorScale * authorScale,
    dz,
    offset: {
      x: 0,
      y: mouseBodyCollision.centerYMetersAtAuthorScale * authorScale,
      z: Math.max(creatureModelLiftMeters(kind, authorScale), dz / 2 + collisionFloorClearanceMeters),
    },
  };
}

function applyObjectPose(root: THREE.Object3D, pose: RigidTransform3): void {
  applyWorldRigidTransform(root, pose);
}
