import path from "node:path";

export const floorTextureBuildConfig = [
  {
    name: "grass1",
    sourcePath: "public/assets/textures/forest_leaves_02_4k/textures/forest_leaves_02_diffuse_4k.jpg",
    runtimePath: "public/assets/textures/forest_leaves_02_4k/runtime/forest_leaves_02_color.ktx2",
    worldIds: ["cube", "dodecahedron", "tetrahedron", "twoPrismLoop"],
    role: "color",
    basisEncoding: "etc1s",
    qualityLevel: 200,
  },
  {
    name: "forest_leaves",
    sourcePath: "public/assets/textures/forest_leaves_02_4k/textures/forest_leaves_02_diffuse_4k.jpg",
    runtimePath: "public/assets/textures/forest_leaves_02_4k/runtime/forest_leaves_02_color.ktx2",
    worldIds: ["cube", "dodecahedron", "tetrahedron"],
    role: "color",
    basisEncoding: "etc1s",
    qualityLevel: 200,
  },
  {
    name: "river_pebbles",
    sourcePath: "public/assets/textures/ganges_river_pebbles_4k/textures/ganges_river_pebbles_diff_4k.jpg",
    runtimePath: "public/assets/textures/ganges_river_pebbles_4k/runtime/ganges_river_pebbles_color.ktx2",
    worldIds: ["cube", "dodecahedron", "tetrahedron", "torus"],
    role: "color",
    basisEncoding: "etc1s",
    qualityLevel: 200,
  },
  {
    name: "gravelly_sand",
    sourcePath: "public/assets/textures/gravelly_sand_4k/textures/gravelly_sand_diff_4k.jpg",
    runtimePath: "public/assets/textures/gravelly_sand_4k/runtime/gravelly_sand_color.ktx2",
    worldIds: ["cube", "dodecahedron", "tetrahedron"],
    role: "color",
    basisEncoding: "etc1s",
    qualityLevel: 200,
  },
  {
    name: "red_mud_stones",
    sourcePath: "public/assets/textures/red_mud_stones_4k/textures/red_mud_stones_diff_4k.jpg",
    runtimePath: "public/assets/textures/red_mud_stones_4k/runtime/red_mud_stones_color.ktx2",
    worldIds: ["cube", "dodecahedron"],
    role: "color",
    basisEncoding: "etc1s",
    qualityLevel: 200,
  },
  {
    name: "snow",
    sourcePath: "public/assets/textures/snow_02_4k/textures/snow_02_diff_4k.jpg",
    runtimePath: "public/assets/textures/snow_02_4k/runtime/snow_02_color.ktx2",
    worldIds: ["cube", "dodecahedron", "twoPrismLoop"],
    role: "color",
    basisEncoding: "etc1s",
    qualityLevel: 200,
  },
];

export function resolveFromRepoRoot(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}
