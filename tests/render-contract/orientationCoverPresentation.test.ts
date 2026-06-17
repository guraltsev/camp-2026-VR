import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import {
  applyOrientationCoverPresentationToVisiblePaths,
  orientationCoverPresentationMatrix,
} from "../../src/render/three/orientationCoverPresentation";
import { threePointToWorld, worldPointToThree } from "../../src/render/three/worldAxes";
import type { CellComplexSpec } from "../../src/cell-complex/specs";
import type { VisiblePortalPath } from "../../src/render/three/visiblePortalPaths";

describe("orientation cover presentation", () => {
  it("flips the axis parallel to the flipped side and keeps the perpendicular axis aligned", () => {
    const world = compileCellComplex(mobiusRoom());
    const matrix = orientationCoverPresentationMatrix(world, "room#positive", "room#negative");

    expect(matrix).toBeDefined();

    const parallelPoint = threePointToWorld(worldPointToThree({ x: 0, y: 0.5, z: 0 }).applyMatrix4(matrix!));
    const perpendicularPoint = threePointToWorld(worldPointToThree({ x: 0.5, y: 0, z: 0 }).applyMatrix4(matrix!));

    expect(parallelPoint.x).toBeCloseTo(0);
    expect(parallelPoint.y).toBeCloseTo(-0.5);
    expect(perpendicularPoint.x).toBeCloseTo(0.5);
    expect(perpendicularPoint.y).toBeCloseTo(0);
    expect(new THREE.Matrix3().setFromMatrix4(matrix!).determinant()).toBeCloseTo(-1);
  });

  it("applies presentation only across opposite orientation sheets", () => {
    const world = compileCellComplex(mobiusRoom());
    const rawPath: VisiblePortalPath = {
      pathId: 7,
      destinationCellId: "room#negative",
      depth: 1,
      rootFromDestinationMatrix: new THREE.Matrix4(),
      clipPolygonNdc: [],
      clipRectNdc: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      screenAreaPixels: 1,
    };
    const [presented] = applyOrientationCoverPresentationToVisiblePaths(world, "room#positive", [rawPath]);
    const [sameSheet] = applyOrientationCoverPresentationToVisiblePaths(world, "room#negative", [rawPath]);

    expect(presented.rootFromDestinationMatrix.equals(rawPath.rootFromDestinationMatrix)).toBe(false);
    expect(sameSheet).toBe(rawPath);
  });
});

function mobiusRoom(): CellComplexSpec {
  const squareRoomBase = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];

  return {
    cells: [
      {
        id: "room",
        heightMeters: 3,
        baseVertices: squareRoomBase,
        portals: [
          {
            id: "east",
            sideIndex: 1,
            targetCellId: "room",
            targetPortalId: "west",
            orientation: "reversing",
          },
          {
            id: "west",
            sideIndex: 3,
            targetCellId: "room",
            targetPortalId: "east",
            orientation: "reversing",
          },
        ],
      },
    ],
  };
}
