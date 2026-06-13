import type { CellObjectSpec, GeodesciMarmotObjectSpec } from "../cell-complex/specs";
import { createGeodesciMarmot } from "./geodesciMarmot";
import { createSimpleGeoCreature, type SimpleGeoCreatureAuthoringParams } from "./simpleGeoCreature";
import { createStaticAssetObject, type StaticObjectAuthoringParams } from "./staticAssets";

const libraryObjectBrand = Symbol("world-library-object");

export interface GeodesicMarmotAuthoringParams {
  readonly position: readonly [x: number, y: number, z: number];
  readonly velocity: readonly [vx: number, vy: number];
  readonly scale?: number;
}

export type WorldLibraryObjectSpec = CellObjectSpec & {
  readonly [libraryObjectBrand]: true;
};

export interface WorldObjectLibrary {
  readonly small_house: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly tree: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly tree_swirl: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly grass: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly bench: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly bicycle: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly flower_group: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly flower_pot: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly stop_sign: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly traffic_cone: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly geo_mouse: (name: string, params: SimpleGeoCreatureAuthoringParams) => WorldLibraryObjectSpec;
  readonly geo_butterfly: (name: string, params: SimpleGeoCreatureAuthoringParams) => WorldLibraryObjectSpec;
  readonly house: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly clock: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly campfire: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly rocks: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly emergency_button: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly geodesic_marmot: (name: string, params: GeodesicMarmotAuthoringParams) => WorldLibraryObjectSpec;
}

export const worldObjectLibrary: WorldObjectLibrary = {
  small_house: (name, params) =>
    createStaticLibraryObject(name, "small_house/small_house.glb", {
      ...params,
      scale: (params.scale ?? 1) * 2.5,
      modelOffset: [0, (params.scale ?? 1) * 2.5 * 0.5, 0],
    }),
  tree: (name, params) =>
    createStaticLibraryObject(name, "Tree1/Tree.glb", {
      ...params,
      scaleXYZ: treeScaleXYZ(params.scale ?? 1),
    }),
  tree_swirl: (name, params) =>
    createStaticLibraryObject(name, "TreeSwirl/tree_swirl.glb", {
      ...params,
      scaleXYZ: treeScaleXYZ(params.scale ?? 1),
    }),
  grass: (name, params) => createStaticLibraryObject(name, "grass1/Grass.glb", params),
  bench: (name, params) =>
    createStaticLibraryObject(name, "Bench/Bench.glb", {
      ...params,
      scale: (params.scale ?? 1) * 0.9,
      modelOffset: [0, (params.scale ?? 1) * 0.9 * 0.45, 0],
    }),
  bicycle: (name, params) =>
    createStaticLibraryObject(name, "bicycle/Bicycle.glb", {
      ...params,
      scale: (params.scale ?? 1) * 0.9,
    }),
  flower_group: (name, params) =>
    createStaticLibraryObject(name, "FloweGroup/flower_group.glb", {
      ...params,
      scale: (params.scale ?? 1) * 0.7,
    }),
  flower_pot: (name, params) =>
    createStaticLibraryObject(name, "flowerPot/flower_pot.glb", {
      ...params,
      scale: (params.scale ?? 1) * 0.75,
    }),
  stop_sign: (name, params) =>
    createStaticLibraryObject(name, "stopsign/stop_sign.glb", {
      ...params,
      scale: (params.scale ?? 1) * 0.75,
    }),
  traffic_cone: (name, params) =>
    createStaticLibraryObject(name, "trafficCone/Cone.glb", {
      ...params,
      scale: (params.scale ?? 1) * 0.75,
    }),
  geo_mouse: (name, params) =>
    brandLibraryObject(createSimpleGeoCreature("geo-mouse", name, "mouse/Mouse.glb", params)),
  geo_butterfly: (name, params) =>
    brandLibraryObject(createSimpleGeoCreature("geo-butterfly", name, "butterfly/Butterfly.glb", params)),
  house: (name, params) => worldObjectLibrary.small_house(name, params),
  clock: (name, params) => createStaticLibraryObject(name, "_legacy/clock_low_poly/scene.gltf", params),
  campfire: (name, params) => createStaticLibraryObject(name, "_legacy/low_poly_campfire/scene.gltf", params),
  rocks: (name, params) => createStaticLibraryObject(name, "_legacy/low_poly_rocks/scene.gltf", params),
  emergency_button: (name, params) =>
    createStaticLibraryObject(name, "_legacy/low_poly_emergency_button/scene.gltf", params),
  geodesic_marmot: (name, params) =>
    brandLibraryObject(
      createGeodesciMarmot({
        id: name,
        position: {
          x: params.position[0],
          y: params.position[2],
          z: params.position[1],
        },
        velocity: {
          x: params.velocity[0],
          y: params.velocity[1],
        },
        scale: params.scale,
      }),
    ),
};

export function isWorldLibraryObjectSpec(value: unknown): value is WorldLibraryObjectSpec {
  if (!value || typeof value !== "object") {
    return false;
  }

  return libraryObjectBrand in value;
}

function createStaticLibraryObject(
  name: string,
  assetPath: string,
  params: StaticObjectAuthoringParams,
): WorldLibraryObjectSpec {
  return brandLibraryObject(createStaticAssetObject(name, assetPath, params));
}

function treeScaleXYZ(scale = 1): readonly [number, number, number] {
  const assetScale = scale * 0.02;
  return [assetScale / 1.5, (assetScale * 2.5) / 3, assetScale / 1.5];
}

function brandLibraryObject<T extends CellObjectSpec | GeodesciMarmotObjectSpec>(objectSpec: T): T & WorldLibraryObjectSpec {
  Object.defineProperty(objectSpec, libraryObjectBrand, {
    value: true,
    enumerable: false,
  });
  return objectSpec as T & WorldLibraryObjectSpec;
}
