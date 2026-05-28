import * as THREE from "three";
import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CellObjectSpec, GeodesciMarmotObjectSpec } from "../cell-complex/specs";
import { yawRigidTransform3, transformDirection3, type RigidTransform3 } from "../math/rigidTransform3";
import { vec3 } from "../math/vec3";
import type { DynamicObjectState } from "../movement/dynamicObject";
import { moveDynamicObject } from "../movement/moveDynamicObject";
import { buildStaticMarmotProxy } from "../render/three/buildDecorationMesh";
import { runtimeDiagnostics } from "../render/three/runtimeDiagnostics";
import type { PreparedWorldAssets } from "../render/three/preloadWorldAssets";
import { applyWorldRigidTransform } from "../render/three/worldAxes";

const defaultCollisionOffset = { x: 0, y: 0, z: 0.22 } as const;
const defaultScale = 0.42;

export interface CreateGeodesciMarmotOptions {
  readonly id: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly velocity: { readonly x: number; readonly y: number };
  readonly scale?: number;
}

export interface GeodesciMarmotRuntime {
  readonly root: THREE.Object3D;
  readonly cellId: string;
  update(world: CompiledCellComplex, deltaSeconds: number): void;
  syncParent(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
  reset(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
}

export function createGeodesciMarmot(options: CreateGeodesciMarmotOptions): GeodesciMarmotObjectSpec {
  return {
    id: options.id,
    kind: "geodesci-marmot",
    assetPath: "racoon-animation/scene.gltf",
    position: options.position,
    scale: options.scale ?? defaultScale,
    yawRadians: yawFromVelocity(options.velocity),
    velocity: options.velocity,
    collision: {
      dx: 0.42,
      dy: 0.72,
      dz: 0.42,
      offset: defaultCollisionOffset,
    },
  };
}

export function isGeodesciMarmotObjectSpec(objectSpec: CellObjectSpec): objectSpec is GeodesciMarmotObjectSpec {
  return objectSpec.kind === "geodesci-marmot";
}

export function createGeodesciMarmotRuntime(
  objectSpec: GeodesciMarmotObjectSpec,
  startCellId: string,
  _assets: PreparedWorldAssets,
): GeodesciMarmotRuntime {
  const root = new THREE.Group();
  root.name = `geodesci-marmot:${objectSpec.id}`;

  const visual = buildStaticMarmotProxy(objectSpec.id);
  visual.rotation.y = Math.PI;
  visual.scale.setScalar(objectSpec.scale ?? defaultScale);
  root.add(visual);
  const initialState = createDynamicObjectState(objectSpec, startCellId);
  let state = initialState;
  const forwardSpeedMetersPerSecond = Math.hypot(objectSpec.velocity.x, objectSpec.velocity.y);
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
      if (forwardSpeedMetersPerSecond <= 0 || deltaSeconds <= 0) {
        return;
      }

      const displacement = transformDirection3(state.localPose, vec3(0, forwardSpeedMetersPerSecond * deltaSeconds, 0));
      const result = moveDynamicObject({
        world,
        object: state,
        displacement,
      });
      state = result.object;
      applyObjectPose(root, state.localPose);
    },
    syncParent(cellRoots) {
      const targetRoot = cellRoots.get(state.cellId);

      if (targetRoot && root.parent !== targetRoot) {
        targetRoot.add(root);
      }
    },
    reset(cellRoots) {
      state = initialState;
      applyObjectPose(root, state.localPose);
      const targetRoot = cellRoots.get(state.cellId);

      if (targetRoot && root.parent !== targetRoot) {
        targetRoot.add(root);
      }
    },
  };
}

function createDynamicObjectState(objectSpec: GeodesciMarmotObjectSpec, cellId: string): DynamicObjectState {
  return {
    cellId,
    localPose: yawRigidTransform3(
      objectSpec.yawRadians ?? yawFromVelocity(objectSpec.velocity),
      vec3(objectSpec.position.x, objectSpec.position.y, objectSpec.position.z),
    ),
    collision: objectSpec.collision,
  };
}

function yawFromVelocity(velocity: GeodesciMarmotObjectSpec["velocity"]): number {
  return Math.atan2(velocity.x, velocity.y);
}

function applyObjectPose(root: THREE.Object3D, pose: RigidTransform3): void {
  applyWorldRigidTransform(root, pose);
}
