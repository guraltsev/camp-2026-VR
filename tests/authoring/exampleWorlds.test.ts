import { describe, expect, it } from "vitest";
import { worldCatalog } from "../../src/authoring/worldCatalog";
import { cube, dodecahedron, icosahedron, octahedron, tetrahedron, torus } from "../../src/authoring/exampleWorlds";
import type { CellComplexSpec } from "../../src/cell-complex/specs";
import { getDynamicObjectCollisionBounds, simpleCylinderIntersectsSimpleCylinder } from "../../src/movement/collision";
import { simpleCollisionCylinder } from "../../src/movement/dynamicObject";
import { DEFAULT_PLAYER_HEIGHT_METERS, DEFAULT_PLAYER_RADIUS_METERS } from "../../src/movement/playerBody";
import { createDefaultPlayerPose, playerPoseToDynamicObject, type PlayerPose } from "../../src/movement/playerPose";
import { yawRigidTransform3 } from "../../src/math/rigidTransform3";

const exampleWorlds = [
  ["cube", cube],
  ["dodecahedron", dodecahedron],
  ["icosahedron", icosahedron],
  ["octahedron", octahedron],
  ["tetrahedron", tetrahedron],
  ["torus", torus],
] as const;

describe("example worlds", () => {
  it.each(exampleWorlds)("does not repeat object assets within %s", (_name, world) => {
    expect(repeatedObjectAssetPaths(world)).toEqual([]);
  });

  it("exposes every Platonic solid as a selectable world", () => {
    expect(worldCatalog.map((entry) => entry.id).sort()).toEqual([
      "cube",
      "dodecahedron",
      "icosahedron",
      "octahedron",
      "tetrahedron",
      "torus",
    ]);
  });

  it("keeps tetrahedron faces equilateral so portal-glued corners align", () => {
    for (const cell of tetrahedron.cells) {
      const sideLengths = cell.baseVertices.map((start, index) => {
        const end = cell.baseVertices[(index + 1) % cell.baseVertices.length];
        return Math.hypot(end.x - start.x, end.y - start.y);
      });

      expect(sideLengths[0]).toBeCloseTo(sideLengths[1], 12);
      expect(sideLengths[1]).toBeCloseTo(sideLengths[2], 12);
    }
  });

  it.each(exampleWorlds)("keeps houses away from the starting player in %s", (_name, world) => {
    const startCell = world.cells[0];
    const playerBounds = getPlayerBounds(getStartPose(world, startCell.id));
    const collidingHouses: string[] = [];

    for (const object of startCell.visuals?.objects ?? []) {
      if (object.kind !== "asset" || object.assetPath !== "small_house/small_house.glb") {
        continue;
      }

      if (!object.collision) {
        throw new Error(`Expected house ${object.id} to have collision bounds.`);
      }

      const objectBounds = getDynamicObjectCollisionBounds({
        cellId: startCell.id,
        localPose: yawRigidTransform3(object.yawRadians ?? 0, object.position),
        collision: object.collision,
      });

      if (!objectBounds) {
        throw new Error(`Expected house ${object.id} collision bounds to compile.`);
      }

      if (simpleCylinderIntersectsSimpleCylinder(playerBounds, objectBounds)) {
        collidingHouses.push(object.id);
      }
    }

    expect(collidingHouses).toEqual([]);
  });

  it("keeps tetrahedron decorative collisions away from the starting player", () => {
    const faceA = tetrahedron.cells.find((cell) => cell.id === "face-a");
    const house = faceA?.visuals?.objects?.find((object) => object.id === "face-a-centerpiece");
    const mouse = faceA?.visuals?.objects?.find((object) => object.id === "face-a-geo-mouse");
    const playerBounds = getPlayerBounds(createDefaultPlayerPose("face-a"));

    expect(house?.kind).toBe("asset");
    expect(house?.collision).toMatchObject({
      radius: 1.09,
      height: 1.8900000000000001,
    });
    expect(mouse?.kind).toBe("geo-mouse");
    expect(mouse?.collision).toEqual({
      radius: 0.42,
      height: 0.6,
      offset: { x: 0, y: 0.75, z: 0.31 },
    });

    if (!house?.collision || !mouse?.collision) {
      throw new Error("Expected house, mouse, and player collision bounds.");
    }

    const houseBounds = getDynamicObjectCollisionBounds({
      cellId: "face-a",
      localPose: yawRigidTransform3(house.yawRadians ?? 0, house.position),
      collision: house.collision,
    });
    const mouseBounds = getDynamicObjectCollisionBounds({
      cellId: "face-a",
      localPose: yawRigidTransform3(mouse.yawRadians ?? 0, { x: 0, y: 0, z: 0 }),
      collision: mouse.collision,
    });

    expect(houseBounds).toBeDefined();
    expect(mouseBounds).toBeDefined();
    expect(simpleCylinderIntersectsSimpleCylinder(playerBounds, houseBounds!)).toBe(false);
    expect(simpleCylinderIntersectsSimpleCylinder(playerBounds, mouseBounds!)).toBe(false);
  });

  it("keeps the tetrahedron stop sign at the corrected small scale", () => {
    const faceD = tetrahedron.cells.find((cell) => cell.id === "face-d");
    const stopSign = faceD?.visuals?.objects?.find((object) => object.id === "face-d-stop-sign");

    expect(stopSign?.kind).toBe("asset");
    expect(stopSign?.scale).toBeCloseTo(0.024);
  });
});

function repeatedObjectAssetPaths(world: CellComplexSpec): string[] {
  const counts = new Map<string, number>();

  for (const cell of world.cells) {
    for (const object of cell.visuals?.objects ?? []) {
      counts.set(object.assetPath, (counts.get(object.assetPath) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([assetPath]) => assetPath)
    .sort();
}

function getStartPose(world: CellComplexSpec, fallbackCellId: string): PlayerPose {
  return world.startingPosition
    ? {
        cellId: world.startingPosition.cellId,
        position: world.startingPosition.position,
        yawRadians: world.startingPosition.yawRadians ?? 0,
        pitchRadians: world.startingPosition.pitchRadians ?? 0,
      }
    : createDefaultPlayerPose(fallbackCellId);
}

function getPlayerBounds(playerPose: PlayerPose) {
  const playerBounds = getDynamicObjectCollisionBounds(
    playerPoseToDynamicObject(
      playerPose,
      simpleCollisionCylinder(DEFAULT_PLAYER_RADIUS_METERS, DEFAULT_PLAYER_HEIGHT_METERS, {
        x: 0,
        y: 0,
        z: DEFAULT_PLAYER_HEIGHT_METERS / 2,
      }),
    ),
  );

  if (!playerBounds) {
    throw new Error("Expected player collision bounds.");
  }

  return playerBounds;
}
