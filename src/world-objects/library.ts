import type { CellObjectSpec, GeodesciMarmotObjectSpec } from "../cell-complex/specs";
import { createGeodesciMarmot } from "./geodesciMarmot";
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
  readonly house: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly clock: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly campfire: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly tree: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly rocks: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly emergency_button: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly geodesic_marmot: (name: string, params: GeodesicMarmotAuthoringParams) => WorldLibraryObjectSpec;
}

export const worldObjectLibrary: WorldObjectLibrary = {
  house: (name, params) => createStaticLibraryObject(name, "house-low-poly/scene.gltf", params),
  clock: (name, params) => createStaticLibraryObject(name, "clock_low_poly/scene.gltf", params),
  campfire: (name, params) => createStaticLibraryObject(name, "low_poly_campfire/scene.gltf", params),
  tree: (name, params) =>
    createStaticLibraryObject(name, "low_poly_tree_wind/scene.gltf", {
      ...params,
      scaleXYZ: treeScaleXYZ(params.scale),
    }),
  rocks: (name, params) => createStaticLibraryObject(name, "low_poly_rocks/scene.gltf", params),
  emergency_button: (name, params) =>
    createStaticLibraryObject(name, "low_poly_emergency_button/scene.gltf", params),
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
  return [scale / 1.5, scale * 2.5, scale / 1.5];
}

function brandLibraryObject<T extends CellObjectSpec | GeodesciMarmotObjectSpec>(objectSpec: T): T & WorldLibraryObjectSpec {
  Object.defineProperty(objectSpec, libraryObjectBrand, {
    value: true,
    enumerable: false,
  });
  return objectSpec as T & WorldLibraryObjectSpec;
}
