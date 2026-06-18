import * as THREE from "three";
import type { CompiledCellComplex } from "../cell-complex/compileCellComplex";
import type { CellObjectSpec, GeodesciMarmotObjectSpec } from "../cell-complex/specs";
import { yawRigidTransform3, transformDirection3, type RigidTransform3 } from "../math/rigidTransform3";
import { vec3 } from "../math/vec3";
import type { DynamicObjectState } from "../movement/dynamicObject";
import {
  AUTONOMOUS_DYNAMIC_OBJECT_PORTAL_CROSSING_MODE,
  moveDynamicObject,
} from "../movement/moveDynamicObject";
import { buildStaticMarmotProxy } from "../render/three/buildDecorationMesh";
import {
  buildObjectCollisionWireframe,
  updateObjectCollisionWireframe,
} from "../render/three/debugCollisionWireframes";
import { runtimeDiagnostics } from "../render/three/runtimeDiagnostics";
import type { PreparedWorldAssets } from "../render/three/preloadWorldAssets";
import { applyWorldRigidTransform } from "../render/three/worldAxes";
import type { RuntimeObjectRegistry } from "./runtimeObjectRegistry";
import { runtimeObjectToDynamicObjectState, type RuntimeCreatureObject } from "./runtimeObjectRegistry";

const defaultCollisionOffset = { x: 0, y: 0, z: 0.22 } as const;
const defaultScale = 0.42;

export interface CreateGeodesciMarmotOptions {
  readonly id: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly velocity: { readonly x: number; readonly y: number };
  readonly scale?: number;
  readonly class?: string;
  readonly do_not_collide_with?: readonly string[];
}

export interface GeodesciMarmotRuntime {
  readonly root: THREE.Object3D;
  readonly objectId: string;
  readonly cellId: string;
  update(world: CompiledCellComplex, deltaSeconds: number): void;
  syncParent(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
  setCollisionWireframeVisible(visible: boolean): void;
  reset(cellRoots: ReadonlyMap<string, THREE.Object3D>): void;
}

export function createGeodesciMarmot(options: CreateGeodesciMarmotOptions): GeodesciMarmotObjectSpec {
  return {
    id: options.id,
    kind: "geodesci-marmot",
    assetPath: "_legacy/racoon-animation/scene.gltf",
    position: options.position,
    scale: options.scale ?? defaultScale,
    yawRadians: yawFromVelocity(options.velocity),
    velocity: options.velocity,
    collision: {
      radius: 0.36,
      height: 0.42,
      offset: defaultCollisionOffset,
    },
    class: options.class ?? "creature",
    do_not_collide_with: options.do_not_collide_with,
  };
}

export function isGeodesciMarmotObjectSpec(objectSpec: CellObjectSpec): objectSpec is GeodesciMarmotObjectSpec {
  return objectSpec.kind === "geodesci-marmot";
}

export function createGeodesciMarmotRuntime(
  objectSpec: GeodesciMarmotObjectSpec,
  startCellId: string,
  _assets: PreparedWorldAssets,
  registry?: RuntimeObjectRegistry,
): GeodesciMarmotRuntime {
  const root = new THREE.Group();
  root.name = `geodesci-marmot:${objectSpec.id}`;

  const visual = buildStaticMarmotProxy(objectSpec.id);
  visual.rotation.y = Math.PI;
  visual.scale.setScalar(objectSpec.scale ?? defaultScale);
  root.add(visual);
  const initialObject = createRuntimeCreatureObject(objectSpec, startCellId);
  registry?.add(initialObject);
  const initialState = runtimeObjectToDynamicObjectState(initialObject);
  let state = initialState;
  const collisionWireframe = buildObjectCollisionWireframe(objectSpec.id, state);
  collisionWireframe.visible = false;
  root.add(collisionWireframe);
  const forwardSpeedMetersPerSecond = Math.hypot(objectSpec.velocity.x, objectSpec.velocity.y);
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
      if (forwardSpeedMetersPerSecond <= 0 || deltaSeconds <= 0) {
        return;
      }

      const displacement = transformDirection3(state.localPose, vec3(0, forwardSpeedMetersPerSecond * deltaSeconds, 0));
      const result = moveDynamicObject({
        world,
        object: state,
        displacement,
        portalCrossingMode: AUTONOMOUS_DYNAMIC_OBJECT_PORTAL_CROSSING_MODE,
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

export function createGeodesciMarmotRuntimeObject(
  objectSpec: GeodesciMarmotObjectSpec,
  cellId: string,
): RuntimeCreatureObject {
  return createRuntimeCreatureObject(objectSpec, cellId);
}

function createRuntimeCreatureObject(objectSpec: GeodesciMarmotObjectSpec, cellId: string): RuntimeCreatureObject {
  return {
    id: objectSpec.id,
    kind: "geodesci-marmot",
    cellId,
    localPose: yawRigidTransform3(
      objectSpec.yawRadians ?? yawFromVelocity(objectSpec.velocity),
      vec3(objectSpec.position.x, objectSpec.position.y, objectSpec.position.z),
    ),
    collision: objectSpec.collision,
    class: objectSpec.class,
    do_not_collide_with: objectSpec.do_not_collide_with,
    portalRenderable: true,
    tooltip: {
      label: "geodesci marmot",
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
  if (!object || object.kind !== "geodesci-marmot") {
    return;
  }

  registry.update({
    ...object,
    cellId: state.cellId,
    localPose: state.localPose,
    collision: state.collision,
  });
}

function yawFromVelocity(velocity: GeodesciMarmotObjectSpec["velocity"]): number {
  return Math.atan2(velocity.x, velocity.y);
}

function applyObjectPose(root: THREE.Object3D, pose: RigidTransform3): void {
  applyWorldRigidTransform(root, pose);
}
