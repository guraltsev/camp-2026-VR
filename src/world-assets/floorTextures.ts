import type { FloorMaterialSpec } from "../cell-complex/specs";

const floorMaterialBrand = Symbol("floor-material");

export interface FloorTextureDefinition {
  readonly name: string;
  readonly floorColor: string;
  readonly defaultTileSizeMeters: number;
  readonly colorTexturePath?: string;
  readonly normalTexturePath?: string;
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

export const floorTextureDefinitions = {
  grass1: {
    name: "grass1",
    floorColor: "#5b8f48",
    defaultTileSizeMeters: 60,
    colorTexturePath: "textures/forest_leaves_02_4k/runtime/forest_leaves_02_color.ktx2",
  },
  forest_leaves: {
    name: "forest_leaves",
    floorColor: "#59633d",
    defaultTileSizeMeters: 48,
    colorTexturePath: "textures/forest_leaves_02_4k/runtime/forest_leaves_02_color.ktx2",
  },
  river_pebbles: {
    name: "river_pebbles",
    floorColor: "#7b7f77",
    defaultTileSizeMeters: 40,
    colorTexturePath: "textures/ganges_river_pebbles_4k/runtime/ganges_river_pebbles_color.ktx2",
  },
  gravelly_sand: {
    name: "gravelly_sand",
    floorColor: "#9b8d6e",
    defaultTileSizeMeters: 48,
    colorTexturePath: "textures/gravelly_sand_4k/runtime/gravelly_sand_color.ktx2",
  },
  red_mud_stones: {
    name: "red_mud_stones",
    floorColor: "#8b4e3f",
    defaultTileSizeMeters: 48,
    colorTexturePath: "textures/red_mud_stones_4k/runtime/red_mud_stones_color.ktx2",
  },
  snow: {
    name: "snow",
    floorColor: "#d8dedf",
    defaultTileSizeMeters: 60,
    colorTexturePath: "textures/snow_02_4k/runtime/snow_02_color.ktx2",
  },
  wood_floor: {
    name: "wood_floor",
    floorColor: "#8b6845",
    defaultTileSizeMeters: 22,
    colorTexturePath: "textures/WoodFloor064_4K-JPG/runtime/WoodFloor064_color.ktx2",
  },
  fabric: {
    name: "fabric",
    floorColor: "#806f75",
    defaultTileSizeMeters: 20,
    colorTexturePath: "textures/Fabric022_4K-JPG/runtime/Fabric022_color.ktx2",
  },
  paving_stones: {
    name: "paving_stones",
    floorColor: "#777872",
    defaultTileSizeMeters: 32,
    colorTexturePath: "textures/PavingStones138_4K-JPG/runtime/PavingStones138_color.ktx2",
  },
  paving_blocks: {
    name: "paving_blocks",
    floorColor: "#8a8379",
    defaultTileSizeMeters: 28,
    colorTexturePath: "textures/PavingStones114_4K-JPG/runtime/PavingStones114_color.ktx2",
  },
  tile_grid: {
    name: "tile_grid",
    floorColor: "#90918a",
    defaultTileSizeMeters: 24,
    colorTexturePath: "textures/Tiles118_4K-JPG/runtime/Tiles118_color.ktx2",
  },
  warm_tiles: {
    name: "warm_tiles",
    floorColor: "#9c8c74",
    defaultTileSizeMeters: 24,
    colorTexturePath: "textures/Tiles132A_4K-JPG/runtime/Tiles132A_color.ktx2",
  },
  brushed_metal: {
    name: "brushed_metal",
    floorColor: "#777b7f",
    defaultTileSizeMeters: 18,
    colorTexturePath: "textures/Metal048C_4K-JPG/runtime/Metal048C_color.ktx2",
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
      normalTexturePath: definition.normalTexturePath,
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
