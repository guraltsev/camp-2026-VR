import type { CellObjectSpec, GeodesciMarmotObjectSpec, SimpleCollisionCylinderSpec } from "../cell-complex/specs";
import { createGeodesciMarmot } from "./geodesciMarmot";
import { createSimpleGeoCreature, type SimpleGeoCreatureAuthoringParams } from "./simpleGeoCreature";
import { createStaticAssetObject, type StaticObjectAuthoringParams } from "./staticAssets";
import { userObjectClass } from "./objectMetadata";

const libraryObjectBrand = Symbol("world-library-object");

export { userObjectClass };

export interface LibraryCollisionOptions {
  readonly class: string;
  readonly do_not_collide_with?: readonly string[];
}

export interface StandardUserRobotObjectDefinition {
  readonly id: "user-robot";
  readonly class: typeof userObjectClass;
  readonly assetPath: string;
  readonly scale: number;
  readonly collision: SimpleCollisionCylinderSpec;
  readonly do_not_collide_with: readonly string[];
}

export const standardUserRobotObject: StandardUserRobotObjectDefinition = {
  id: "user-robot",
  class: userObjectClass,
  assetPath: "rover/rover.glb",
  scale: 0.1925,
  collision: {
    radius: 0.32,
    height: 1,
    offset: { x: 0, y: 0, z: 0.5 },
  },
  do_not_collide_with: [],
};

interface StaticLibraryDefinition {
  readonly assetPath: string;
  readonly class: string;
  readonly visualScale?: number;
  readonly visualScaleXYZ?: (authorScale: number) => readonly [number, number, number];
  readonly modelOffset?: (authorScale: number) => readonly [number, number, number];
  readonly collision?: (authorScale: number) => SimpleCollisionCylinderSpec;
  readonly do_not_collide_with?: readonly string[];
}

const smallHouseAssetScale = 2.5;
const smallHouseFootprintCenter = {
  // Center of public/assets/small_house/small_house.glb in authoring world axes,
  // measured from the asset bounds after the library's base model scale.
  x: 0.17220746725797653,
  y: -0.084492526948451995,
};

const staticLibraryDefinitions = {
  small_house: {
    assetPath: "small_house/small_house.glb",
    class: "house",
    visualScale: smallHouseAssetScale,
    modelOffset: (scale) => [0, scale * smallHouseAssetScale * 0.5, 0],
    collision: (scale) => ({
      radius: scale * 1.1 + 0.1,
      height: scale * 2.1,
      offset: {
        x: scale * smallHouseFootprintCenter.x,
        y: scale * smallHouseFootprintCenter.y,
        z: scale * 1.05,
      },
    }),
  },
  tree: {
    assetPath: "Tree1/Tree.glb",
    class: "tree",
    visualScaleXYZ: treeScaleXYZ,
    collision: (scale) => ({
      radius: scale * 0.42,
      height: scale * 3.1,
      offset: { x: 0, y: 0, z: scale * 1.55 },
    }),
  },
  tree_swirl: {
    assetPath: "TreeSwirl/tree_swirl.glb",
    class: "tree",
    visualScaleXYZ: treeScaleXYZ,
    collision: (scale) => ({
      radius: scale * 0.48,
      height: scale * 3.3,
      offset: { x: 0, y: 0, z: scale * 1.65 },
    }),
  },
  grass: {
    assetPath: "grass1/Grass.glb",
    class: "decoration",
    do_not_collide_with: [userObjectClass],
  },
  bench: {
    assetPath: "Bench/Bench.glb",
    class: "bench",
    visualScale: 0.9,
    modelOffset: (scale) => [0, scale * 0.9 * 0.45, 0],
    collision: (scale) => ({
      radius: scale * 0.8,
      height: scale * 0.9,
      offset: { x: 0, y: 0, z: scale * 0.45 },
    }),
  },
  bicycle: {
    assetPath: "bicycle/Bicycle.glb",
    class: "bicycle",
    visualScale: 0.9,
    collision: (scale) => ({
      radius: scale * 0.85,
      height: scale * 1.1,
      offset: { x: 0, y: 0, z: scale * 0.55 },
    }),
  },
  flower_group: {
    assetPath: "FloweGroup/flower_group.glb",
    class: "decoration",
    visualScale: 0.7,
    do_not_collide_with: [userObjectClass],
  },
  flower_pot: {
    assetPath: "flowerPot/flower_pot.glb",
    class: "decoration",
    visualScale: 0.75,
    collision: (scale) => ({
      radius: scale * 0.28,
      height: scale * 0.5,
      offset: { x: 0, y: 0, z: scale * 0.25 },
    }),
  },
  stop_sign: {
    assetPath: "stopsign/stop_sign.glb",
    class: "sign",
    visualScale: 0.03,
    collision: (scale) => ({
      radius: scale * 0.32,
      height: scale * 2.15,
      offset: { x: 0, y: 0, z: scale * 1.075 },
    }),
  },
  traffic_cone: {
    assetPath: "trafficCone/Cone.glb",
    class: "cone",
    visualScale: 0.75,
    collision: (scale) => ({
      radius: scale * 0.32,
      height: scale * 0.75,
      offset: { x: 0, y: 0, z: scale * 0.375 },
    }),
  },
  clock: {
    assetPath: "_legacy/clock_low_poly/scene.gltf",
    class: "decoration",
    do_not_collide_with: [userObjectClass],
  },
  campfire: {
    assetPath: "_legacy/low_poly_campfire/scene.gltf",
    class: "decoration",
    collision: (scale) => ({
      radius: scale * 0.55,
      height: scale * 0.45,
      offset: { x: 0, y: 0, z: scale * 0.225 },
    }),
  },
  rocks: {
    assetPath: "_legacy/low_poly_rocks/scene.gltf",
    class: "decoration",
    collision: (scale) => ({
      radius: scale * 0.45,
      height: scale * 0.35,
      offset: { x: 0, y: 0, z: scale * 0.175 },
    }),
  },
  emergency_button: {
    assetPath: "_legacy/low_poly_emergency_button/scene.gltf",
    class: "interactive",
    collision: (scale) => ({
      radius: scale * 0.25,
      height: scale * 0.25,
      offset: { x: 0, y: 0, z: scale * 0.125 },
    }),
  },
} as const satisfies Record<string, StaticLibraryDefinition>;

export interface GeodesicMarmotAuthoringParams {
  readonly position: readonly [x: number, y: number, z: number];
  readonly velocity: readonly [vx: number, vy: number];
  readonly scale?: number;
  readonly class?: string;
  readonly do_not_collide_with?: readonly string[];
  readonly doNotCollideWith?: readonly string[];
}

export type WorldLibraryObjectSpec = CellObjectSpec & {
  readonly [libraryObjectBrand]: true;
};

export interface WorldObjectLibrary {
  /**
   * Static authored objects. Each has library-owned base asset scale, collision class, and collision area.
   * Authors may override position, scale, turn, tilt, collision, class, and do_not_collide_with per instance.
   */
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
  /**
   * Autonomous creature objects. Authors may set speed, oscillationRate,
   * oscillationMagnitude, turn, scale, collision, class, and do_not_collide_with.
   */
  readonly geo_mouse: (name: string, params: SimpleGeoCreatureAuthoringParams) => WorldLibraryObjectSpec;
  readonly geo_butterfly: (name: string, params: SimpleGeoCreatureAuthoringParams) => WorldLibraryObjectSpec;
  /** Alias for small_house. */
  readonly house: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly clock: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly campfire: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly rocks: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  readonly emergency_button: (name: string, params: StaticObjectAuthoringParams) => WorldLibraryObjectSpec;
  /**
   * Autonomous moving object. Authors may set scale, class, do_not_collide_with,
   * and velocity; the library owns its default asset, size, and collision area.
   */
  readonly geodesic_marmot: (name: string, params: GeodesicMarmotAuthoringParams) => WorldLibraryObjectSpec;
}

export const worldObjectLibrary: WorldObjectLibrary = {
  small_house: (name, params) => createDefinedStaticLibraryObject("small_house", name, params),
  tree: (name, params) => createDefinedStaticLibraryObject("tree", name, params),
  tree_swirl: (name, params) => createDefinedStaticLibraryObject("tree_swirl", name, params),
  grass: (name, params) => createDefinedStaticLibraryObject("grass", name, params),
  bench: (name, params) => createDefinedStaticLibraryObject("bench", name, params),
  bicycle: (name, params) => createDefinedStaticLibraryObject("bicycle", name, params),
  flower_group: (name, params) => createDefinedStaticLibraryObject("flower_group", name, params),
  flower_pot: (name, params) => createDefinedStaticLibraryObject("flower_pot", name, params),
  stop_sign: (name, params) => createDefinedStaticLibraryObject("stop_sign", name, params),
  traffic_cone: (name, params) => createDefinedStaticLibraryObject("traffic_cone", name, params),
  geo_mouse: (name, params) =>
    brandLibraryObject(createSimpleGeoCreature("geo-mouse", name, "mouse/Mouse.glb", params)),
  geo_butterfly: (name, params) =>
    brandLibraryObject(createSimpleGeoCreature("geo-butterfly", name, "butterfly/Butterfly.glb", params)),
  house: (name, params) => worldObjectLibrary.small_house(name, params),
  clock: (name, params) => createDefinedStaticLibraryObject("clock", name, params),
  campfire: (name, params) => createDefinedStaticLibraryObject("campfire", name, params),
  rocks: (name, params) => createDefinedStaticLibraryObject("rocks", name, params),
  emergency_button: (name, params) => createDefinedStaticLibraryObject("emergency_button", name, params),
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
        class: params.class,
        do_not_collide_with: params.do_not_collide_with ?? params.doNotCollideWith,
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

function createDefinedStaticLibraryObject(
  key: keyof typeof staticLibraryDefinitions,
  name: string,
  params: StaticObjectAuthoringParams,
): WorldLibraryObjectSpec {
  const definition: StaticLibraryDefinition = staticLibraryDefinitions[key];
  const authorScale = params.scale ?? 1;
  const resolvedParams: StaticObjectAuthoringParams = {
    ...params,
    scale: params.scaleXYZ ? params.scale : authorScale * (definition.visualScale ?? 1),
    scaleXYZ: params.scaleXYZ ?? definition.visualScaleXYZ?.(authorScale),
    modelOffset: params.modelOffset ?? definition.modelOffset?.(authorScale),
    collision: params.collision ?? definition.collision?.(authorScale),
    class: params.class ?? definition.class,
    do_not_collide_with: params.do_not_collide_with ?? params.doNotCollideWith ?? definition.do_not_collide_with,
  };

  return createStaticLibraryObject(name, definition.assetPath, resolvedParams);
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
