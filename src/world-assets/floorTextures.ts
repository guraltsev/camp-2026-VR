import type { FloorMaterialSpec } from "../cell-complex/specs";

const floorMaterialBrand = Symbol("floor-material");

export interface FloorTextureDefinition {
  readonly name: string;
  readonly floorColor: string;
  readonly defaultTileSizeMeters: number;
  readonly colorTexturePath?: string;
  readonly bumpTexturePath?: string;
  readonly roughnessTexturePath?: string;
}

export interface FloorTextureOptions {
  readonly tileSize?: number;
  readonly floorColor?: string;
}

export interface FloorColorOptions {
  readonly color: string;
}

export type WorldFloorMaterialSpec = FloorMaterialSpec & {
  readonly [floorMaterialBrand]: true;
};

const floorTextureDefinitions = {
  grass1: {
    name: "grass1",
    floorColor: "#5b8f48",
    defaultTileSizeMeters: 60,
    colorTexturePath: "textures/forest_leaves_02_4k/textures/forest_leaves_02_diffuse_4k.jpg",
    bumpTexturePath: "textures/forest_leaves_02_4k/textures/forest_leaves_02_disp_4k.png",
    roughnessTexturePath: "textures/forest_leaves_02_4k/textures/forest_leaves_02_rough_4k.jpg",
  },
  forest_leaves: {
    name: "forest_leaves",
    floorColor: "#59633d",
    defaultTileSizeMeters: 48,
    colorTexturePath: "textures/forest_leaves_02_4k/textures/forest_leaves_02_diffuse_4k.jpg",
    bumpTexturePath: "textures/forest_leaves_02_4k/textures/forest_leaves_02_disp_4k.png",
    roughnessTexturePath: "textures/forest_leaves_02_4k/textures/forest_leaves_02_rough_4k.jpg",
  },
  river_pebbles: {
    name: "river_pebbles",
    floorColor: "#7b7f77",
    defaultTileSizeMeters: 40,
    colorTexturePath: "textures/ganges_river_pebbles_4k/textures/ganges_river_pebbles_diff_4k.jpg",
    bumpTexturePath: "textures/ganges_river_pebbles_4k/textures/ganges_river_pebbles_disp_4k.png",
    roughnessTexturePath: "textures/ganges_river_pebbles_4k/textures/ganges_river_pebbles_disp_4k.png",
  },
  gravelly_sand: {
    name: "gravelly_sand",
    floorColor: "#9b8d6e",
    defaultTileSizeMeters: 48,
    colorTexturePath: "textures/gravelly_sand_4k/textures/gravelly_sand_diff_4k.jpg",
    bumpTexturePath: "textures/gravelly_sand_4k/textures/gravelly_sand_disp_4k.png",
    roughnessTexturePath: "textures/gravelly_sand_4k/textures/gravelly_sand_disp_4k.png",
  },
  red_mud_stones: {
    name: "red_mud_stones",
    floorColor: "#8b4e3f",
    defaultTileSizeMeters: 48,
    colorTexturePath: "textures/red_mud_stones_4k/textures/red_mud_stones_diff_4k.jpg",
    bumpTexturePath: "textures/red_mud_stones_4k/textures/red_mud_stones_disp_4k.png",
    roughnessTexturePath: "textures/red_mud_stones_4k/textures/red_mud_stones_rough_4k.jpg",
  },
  snow: {
    name: "snow",
    floorColor: "#d8dedf",
    defaultTileSizeMeters: 60,
    colorTexturePath: "textures/snow_02_4k/textures/snow_02_diff_4k.jpg",
    bumpTexturePath: "textures/snow_02_4k/textures/snow_02_disp_4k.png",
    roughnessTexturePath: "textures/snow_02_4k/textures/snow_02_rough_4k.jpg",
  },
} satisfies Record<string, FloorTextureDefinition>;

export type FloorTextureName = keyof typeof floorTextureDefinitions;

export interface WorldFloorTextureLibrary {
  readonly floorTexture: {
    (name: FloorTextureName, options?: FloorTextureOptions): WorldFloorMaterialSpec;
    (options: FloorColorOptions): WorldFloorMaterialSpec;
  };
}

export const worldFloorTextureLibrary: WorldFloorTextureLibrary = {
  floorTexture(input: FloorTextureName | FloorColorOptions, options: FloorTextureOptions = {}) {
    if (typeof input !== "string") {
      return brandFloorMaterial({
        kind: "floor-color",
        floorColor: input.color,
      });
    }

    const definition: FloorTextureDefinition = floorTextureDefinitions[input];

    if (!definition) {
      throw new Error(`Unknown floor texture "${input}".`);
    }

    return brandFloorMaterial({
      kind: "floor-texture",
      name: definition.name,
      floorColor: options.floorColor ?? definition.floorColor,
      tileSizeMeters: options.tileSize ?? definition.defaultTileSizeMeters,
      colorTexturePath: definition.colorTexturePath,
      bumpTexturePath: definition.bumpTexturePath,
      roughnessTexturePath: definition.roughnessTexturePath,
    });
  },
};

export function isWorldFloorMaterialSpec(value: unknown): value is WorldFloorMaterialSpec {
  if (!value || typeof value !== "object") {
    return false;
  }

  return floorMaterialBrand in value;
}

export function normalizeFloorMaterial(input: string | WorldFloorMaterialSpec): FloorMaterialSpec {
  if (typeof input === "string") {
    return {
      kind: "floor-color",
      floorColor: input,
    };
  }

  return { ...input };
}

function brandFloorMaterial<T extends FloorMaterialSpec>(material: T): T & WorldFloorMaterialSpec {
  Object.defineProperty(material, floorMaterialBrand, {
    value: true,
    enumerable: false,
  });
  return material as T & WorldFloorMaterialSpec;
}
