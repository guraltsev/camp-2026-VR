import { describe, expect, it } from "vitest";
import { torus } from "../../src/authoring/exampleWorlds";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { checkPortalPathString } from "../../src/cell-complex/portalPathDebug";
import { buildStaticallyCulledPortalPathTables } from "../../src/cell-complex/staticPortalPathCull";
import { yawRigidTransform3 } from "../../src/math/rigidTransform3";
import { vec3 } from "../../src/math/vec3";
import {
  buildTorusParallelogramVertices,
  createTorusSkewCellDeformationMaps,
  createTorusSkewDeformationFamily,
  defaultTorusSkewDeformationState,
  type TorusSkewDeformationState,
} from "../../src/runtime/deformations/torusSkewDeformation";
import { transformRigidPoseWithMap } from "../../src/runtime/worldGeometryDeformations";

describe("torus skew deformation", () => {
  it("zero skew reproduces the current torus square", () => {
    expect(buildTorusParallelogramVertices(defaultTorusSkewDeformationState)).toEqual(torus.cells[0].baseVertices);
  });

  it("positive skew produces a convex parallelogram", () => {
    expect(buildTorusParallelogramVertices(skewState(2))).toEqual([
      { x: -8.5, y: -7.5 },
      { x: 6.5, y: -7.5 },
      { x: 8.5, y: 7.5 },
      { x: -6.5, y: 7.5 },
    ]);

    const world = compileCellComplex(createTorusSkewDeformationFamily().applyToSpec(torus, skewState(2)));

    expect(world.cellsById.get("torus-room")?.isConvex).toBe(true);
  });

  it("rejects negative A offsets", () => {
    expect(() => createTorusSkewDeformationFamily().applyToSpec(torus, skewState(-2)))
      .toThrowError(/A must be between 0m and 30m/);
  });

  it("keeps side ids and portal ids unchanged", () => {
    const spec = createTorusSkewDeformationFamily().applyToSpec(torus, skewState(1));

    expect(spec.cells[0].id).toBe(torus.cells[0].id);
    expect(spec.cells[0].portals).toEqual(torus.cells[0].portals);
  });

  it("keeps opposite side lengths equal", () => {
    const world = compileCellComplex(createTorusSkewDeformationFamily().applyToSpec(torus, skewState(2)));
    const room = world.cellsById.get("torus-room")!;

    expect(room.sides[0].lengthMeters).toBeCloseTo(room.sides[2].lengthMeters);
    expect(room.sides[1].lengthMeters).toBeCloseTo(room.sides[3].lengthMeters);
  });

  it("preserves lattice coordinates for point transforms", () => {
    const maps = createTorusSkewCellDeformationMaps(skewState(0), skewState(2));
    const map = maps.get("torus-room")!;
    const point = vec3(0, 0, 1.25);

    expect(map.mapPoint(point)).toEqual({ x: 0, y: 0, z: 1.25 });
    expect(map.mapPoint(vec3(-7.5, -7.5, 0))).toEqual({ x: -8.5, y: -7.5, z: 0 });
  });

  it("maps a vertical-lattice heading into the skewed heading", () => {
    const map = createTorusSkewCellDeformationMaps(skewState(0), skewState(2)).get("torus-room")!;
    const transformed = map.mapDirection(vec3(0, 1, 0));

    expect(transformed.x / transformed.y).toBeCloseTo(2 / 15);

    const pose = transformRigidPoseWithMap(yawRigidTransform3(Math.PI / 2, vec3(0, 0, 0)), map);

    expect(Math.tan(Math.atan2(pose.rotation.m10, pose.rotation.m00))).toBeCloseTo(15 / 2);
  });

  it("rejects invalid non-torus specs clearly", () => {
    const family = createTorusSkewDeformationFamily();

    expect(() =>
      family.applyToSpec(
        {
          cells: [
            {
              ...torus.cells[0],
              id: "not-torus",
            },
          ],
        },
        skewState(1),
      ),
    ).toThrowError(/Expected a "torus-room" cell/);
  });

  it("compiles skewed torus portal transforms without NaN or Infinity", () => {
    const world = compileCellComplex(createTorusSkewDeformationFamily().applyToSpec(torus, skewState(2)));

    for (const cell of world.cells) {
      for (const portal of cell.portals) {
        expect(Object.values(portal.transformToTarget.rotation).every(Number.isFinite)).toBe(true);
        expect(Object.values(portal.transformToTarget.translation).every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("keeps immediate reverse paths filtered under depth-10 static culling", () => {
    const world = compileCellComplex(createTorusSkewDeformationFamily().applyToSpec(torus, skewState(2)));
    const staticCull = buildStaticallyCulledPortalPathTables(world, {
      maxDepth: 10,
      skipImmediateReverse: true,
      toleranceMeters: 1e-6,
      maxKeptPathsPerRoot: 50_000,
    });
    const check = checkPortalPathString("0 2", {
      world,
      rootCellId: "torus-room",
      candidateTables: staticCull.tables,
      keptTables: staticCull.tables,
      cullSummariesByRootCellId: staticCull.summariesByRootCellId,
    });

    expect(staticCull.tables.tablesByRootCellId.get("torus-room")?.paths.length).toBeGreaterThan(0);
    expect(check.existsInBuiltTable).toBe(false);
  });
});

function skewState(skewXMeters: number): TorusSkewDeformationState {
  return {
    kind: "torus-skew",
    cellId: "torus-room",
    widthMeters: 15,
    depthMeters: 15,
    skewXMeters,
  };
}
