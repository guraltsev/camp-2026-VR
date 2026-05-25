import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { cube } from "../../src/cell-complex/examples/cube";
import { tetrahedron } from "../../src/cell-complex/examples/tetrahedron";
import { torus } from "../../src/cell-complex/examples/torus";
import { twoPrismLoop } from "../../src/cell-complex/examples/twoPrismLoop";
import { validateAuthoringSpec } from "../../src/authoring/validateAuthoringSpec";
import {
  composeRigidTransform3,
  identityMat3,
  invertRigidTransform3,
  transformDirection3,
  transformPoint3,
} from "../../src/math/rigidTransform3";
import { almostEqualVec3, normalizeVec3, vec3 } from "../../src/math/vec3";

describe("compileCellComplex", () => {
  it("preserves the visible prism cells from the starter world", () => {
    const compiled = compileCellComplex(twoPrismLoop);

    expect(compiled.cells.map((cell) => cell.id)).toEqual(["room-a", "room-b"]);
  });

  it("compiles the stage geometry examples", () => {
    expect(compileCellComplex(torus).cells.map((cell) => cell.id)).toEqual(["torus-room"]);
    expect(compileCellComplex(tetrahedron).cells).toHaveLength(4);
    expect(compileCellComplex(cube).cells).toHaveLength(6);
    expect(compileCellComplex(cube).cells.every((cell) => cell.sideCount === 4)).toBe(true);
    expect(compileCellComplex(cube).cells.every((cell) => cell.objects.length === 1)).toBe(true);
  });

  it("compiles portal lookups, side geometry, and forbidden zones for movement", () => {
    const compiled = compileCellComplex(twoPrismLoop);
    const roomA = compiled.cellsById.get("room-a");
    const eastPortal = roomA?.portalsById.get("east");

    expect(roomA?.isConvex).toBe(true);
    expect(eastPortal?.targetCellId).toBe("room-b");
    expect(roomA?.portalBySideIndex.get(1)?.id).toBe("east");
    expect(roomA?.sides).toHaveLength(4);
    expect(eastPortal?.transformToTarget.rotation).toEqual(identityMat3);
    expect(eastPortal?.transformToTarget.translation).toEqual({ x: -15, y: 0, z: 0 });
    expect(roomA?.forbiddenZones.map((zone) => zone.junctionId)).toEqual(["room-a:vertex-1", "room-a:vertex-2"]);
    expect(roomA?.singularityColumns.map((column) => column.junctionId)).toEqual([
      "room-a:vertex-1",
      "room-a:vertex-2",
    ]);
    expect(roomA?.singularityColumns[0]?.kind).toBe("invisible-column");
    expect(roomA?.singularityColumns[0]?.heightMeters).toBe(roomA?.heightMeters);
  });

  it("derives expected wraparound translations for the torus example", () => {
    const compiled = compileCellComplex(torus);
    const room = compiled.cellsById.get("torus-room");

    expect(room?.portalsById.get("south")?.transformToTarget.translation).toEqual({ x: 0, y: 0, z: 15 });
    expect(room?.portalsById.get("east")?.transformToTarget.translation).toEqual({ x: -15, y: 0, z: 0 });
    expect(room?.portalsById.get("north")?.transformToTarget.translation).toEqual({ x: 0, y: 0, z: -15 });
    expect(room?.portalsById.get("west")?.transformToTarget.translation).toEqual({ x: 15, y: 0, z: 0 });
  });

  it("derives seam-consistent compiled transforms for every example portal", () => {
    for (const world of [twoPrismLoop, torus, cube, tetrahedron]) {
      const compiled = compileCellComplex(world);

      for (const cell of compiled.cells) {
        for (const portal of cell.portals) {
          const sourceSide = cell.sides[portal.sideIndex];
          const targetCell = compiled.cellsById.get(portal.targetCellId);
          const targetPortal = targetCell?.portalsById.get(portal.targetPortalId);

          expect(targetCell).toBeDefined();
          expect(targetPortal).toBeDefined();

          const targetSide = targetCell!.sides[targetPortal!.sideIndex];
          const sourceMidpoint = midpointOf(sourceSide);
          const targetMidpoint = midpointOf(targetSide);
          const sourceTangent = tangentOf(sourceSide);
          const targetTangent = tangentOf(targetSide);
          const sourceOutward = vec3(-sourceSide.inwardNormal.x, 0, -sourceSide.inwardNormal.z);
          const targetInward = vec3(targetSide.inwardNormal.x, 0, targetSide.inwardNormal.z);

          expect(almostEqualVec3(transformPoint3(portal.transformToTarget, sourceMidpoint), targetMidpoint)).toBe(true);
          expect(
            almostEqualVec3(
              normalizeVec3(transformDirection3(portal.transformToTarget, sourceTangent)),
              normalizeVec3(vec3(-targetTangent.x, -targetTangent.y, -targetTangent.z)),
            ),
          ).toBe(true);
          expect(
            almostEqualVec3(
              normalizeVec3(transformDirection3(portal.transformToTarget, sourceOutward)),
              normalizeVec3(targetInward),
            ),
          ).toBe(true);

          const roundTrip = composeRigidTransform3(targetPortal!.transformToTarget, portal.transformToTarget);

          expect(almostEqualVec3(roundTrip.translation, vec3(0, 0, 0))).toBe(true);
          expect(
            almostEqualVec3(
              transformPoint3(invertRigidTransform3(portal.transformToTarget), targetMidpoint),
              sourceMidpoint,
            ),
          ).toBe(true);
          expect(roundTrip.rotation.m00).toBeCloseTo(1);
          expect(roundTrip.rotation.m11).toBeCloseTo(1);
          expect(roundTrip.rotation.m22).toBeCloseTo(1);
        }
      }
    }
  });

  it("reports readable movement-critical authoring errors", () => {
    const errors = validateAuthoringSpec({
      cells: [
        {
          id: "room",
          heightMeters: 2,
          baseVertices: [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 0, z: 1 },
          ],
          portals: [
            {
              id: "bad",
              sideIndex: 3,
              targetCellId: "missing",
              targetPortalId: "also-missing",
            },
            {
              id: "bad",
              sideIndex: 0,
              targetCellId: "room",
              targetPortalId: "bad",
            },
          ],
        },
        {
          id: "room",
          heightMeters: 2,
          baseVertices: [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 0, z: 1 },
          ],
          portals: [],
        },
      ],
    });

    expect(errors).toContain('Duplicate cell id "room".');
    expect(errors).toContain('Cell "room" has duplicate portal id "bad".');
    expect(errors).toContain('Portal "room:bad" has sideIndex 3, expected 0-2.');
    expect(errors).toContain('Portal "room:bad" targets missing cell "missing".');
    expect(errors).toContain('Portal "room:bad" is not reciprocated by "room:bad".');
  });

  it("rejects non-convex and clockwise prism bases for stage 03 movement", () => {
    const nonConvexErrors = validateAuthoringSpec({
      cells: [
        {
          id: "non-convex",
          heightMeters: 2,
          baseVertices: [
            { x: 0, z: 0 },
            { x: 2, z: 0 },
            { x: 1, z: 1 },
            { x: 2, z: 2 },
            { x: 0, z: 2 },
          ],
          portals: [],
        },
      ],
    });
    const clockwiseErrors = validateAuthoringSpec({
      cells: [
        {
          id: "clockwise",
          heightMeters: 2,
          baseVertices: [
            { x: -1, z: -1 },
            { x: -1, z: 1 },
            { x: 1, z: 1 },
            { x: 1, z: -1 },
          ],
          portals: [],
        },
      ],
    });

    expect(nonConvexErrors).toContain(
      'Cell "non-convex" must be strictly convex; non-convex prism cells are not supported in stage 03.',
    );
    expect(clockwiseErrors).toContain(
      'Cell "clockwise" must list baseVertices in counterclockwise order for stage 03 movement.',
    );
    expect(() =>
      compileCellComplex({
        cells: [
          {
            id: "non-convex",
            heightMeters: 2,
            baseVertices: [
              { x: 0, z: 0 },
              { x: 2, z: 0 },
              { x: 1, z: 1 },
              { x: 2, z: 2 },
              { x: 0, z: 2 },
            ],
            portals: [],
          },
        ],
      }),
    ).toThrowError(/non-convex prism cells are not supported in stage 03/);
  });
});

function midpointOf(side: { readonly start: { readonly x: number; readonly z: number }; readonly end: { readonly x: number; readonly z: number } }) {
  return vec3((side.start.x + side.end.x) / 2, 0, (side.start.z + side.end.z) / 2);
}

function tangentOf(side: { readonly start: { readonly x: number; readonly z: number }; readonly end: { readonly x: number; readonly z: number } }) {
  return normalizeVec3(vec3(side.end.x - side.start.x, 0, side.end.z - side.start.z));
}
