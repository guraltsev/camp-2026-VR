import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { buildPortalPathTables, type PortalRenderPath } from "../../src/cell-complex/portalPaths";
import type { CellComplexSpec } from "../../src/cell-complex/specs";
import { yawRigidTransform3 } from "../../src/math/rigidTransform3";
import { createPlacedFlagObject } from "../../src/world-objects/placedFlags";
import { createRuntimeObjectRegistry } from "../../src/world-objects/runtimeObjectRegistry";
import { resolveAimTarget } from "../../src/render/three/aimTarget";
import type { VisiblePortalPath } from "../../src/render/three/visiblePortalPaths";
import { rigidTransformToThreeMatrix, worldPointToThree } from "../../src/render/three/worldAxes";

describe("resolveAimTarget", () => {
  it("resolves the floor point in the current cell", () => {
    const world = compileCellComplex(singleRoomWorld());
    const registry = createRuntimeObjectRegistry();
    const rootPath = buildPortalPathTables(world, { maxDepth: 0 }).tablesByRootCellId.get("room")!.pathsById.get(0)!;
    const camera = cameraLookingAt({ x: 0, y: -2, z: 1.5 }, { x: 0, y: 0, z: 0 });

    const target = resolveAimTarget({
      world,
      registry,
      camera,
      visiblePortalPaths: [visiblePath(rootPath)],
    });

    expect(target?.kind).toBe("floor");
    expect(target?.cellId).toBe("room");
    expect(target?.localPoint.x).toBeCloseTo(0);
    expect(target?.localPoint.y).toBeCloseTo(0);
    expect(target?.localPoint.z).toBeCloseTo(0);
    expect(target?.localNormal).toEqual({ x: 0, y: 0, z: 1 });
    expect(target?.rootNormal.x).toBeCloseTo(0);
    expect(target?.rootNormal.y).toBeCloseTo(0);
    expect(target?.rootNormal.z).toBeCloseTo(1);
  });

  it("resolves collidable runtime objects before the floor behind them", () => {
    const world = compileCellComplex(singleRoomWorld());
    const flag = createPlacedFlagObject({
      id: "flag-a",
      cellId: "room",
      localPose: yawRigidTransform3(0, { x: 0, y: 0, z: 0 }),
      flagType: "WoodenSign1",
    });
    const registry = createRuntimeObjectRegistry([flag]);
    const rootPath = buildPortalPathTables(world, { maxDepth: 0 }).tablesByRootCellId.get("room")!.pathsById.get(0)!;
    const camera = cameraLookingAt({ x: 0, y: -2, z: 0.575 }, { x: 0, y: 0, z: 0.575 });

    const target = resolveAimTarget({
      world,
      registry,
      camera,
      visiblePortalPaths: [visiblePath(rootPath)],
    });

    expect(target?.kind).toBe("object");
    expect(target?.object?.id).toBe("flag-a");
    expect(target?.localNormal.x).toBeCloseTo(0);
    expect(target?.localNormal.y).toBeCloseTo(-1);
    expect(target?.localNormal.z).toBeCloseTo(0);
  });

  it("resolves a floor point in a visible destination cell", () => {
    const world = compileCellComplex(twoRoomPortalWorld());
    const registry = createRuntimeObjectRegistry();
    const pathTable = buildPortalPathTables(world, { maxDepth: 1 }).tablesByRootCellId.get("room-a")!;
    const destinationPath = pathTable.paths.find((path) => path.destinationCellId === "room-b")!;
    const rootTarget = destinationLocalPointInRoot(destinationPath, { x: 0, y: 0, z: 0 });
    const camera = cameraLookingAt({ x: 0, y: 0, z: 1.5 }, rootTarget);

    const target = resolveAimTarget({
      world,
      registry,
      camera,
      visiblePortalPaths: [visiblePath(pathTable.pathsById.get(0)!), visiblePath(destinationPath)],
    });

    expect(target?.kind).toBe("floor");
    expect(target?.cellId).toBe("room-b");
    expect(target?.localPoint.x).toBeCloseTo(0);
    expect(target?.localPoint.y).toBeCloseTo(0);
    expect(target?.localNormal).toEqual({ x: 0, y: 0, z: 1 });
    expect(target?.rootNormal.z).toBeCloseTo(1);
  });

  it("does not resolve floor aiming inside a forbidden zone", () => {
    const world = compileCellComplex(twoRoomPortalWorld());
    const registry = createRuntimeObjectRegistry();
    const pathTable = buildPortalPathTables(world, { maxDepth: 1 }).tablesByRootCellId.get("room-a")!;
    const destinationPath = pathTable.paths.find((path) => path.destinationCellId === "room-b")!;
    const rootTarget = destinationLocalPointInRoot(destinationPath, { x: -1, y: -1, z: 0 });
    const camera = cameraLookingAt({ x: 0, y: 0, z: 1.5 }, rootTarget);

    const target = resolveAimTarget({
      world,
      registry,
      camera,
      visiblePortalPaths: [visiblePath(pathTable.pathsById.get(0)!), visiblePath(destinationPath)],
    });

    expect(target).toBeUndefined();
  });
});

function visiblePath(path: PortalRenderPath): VisiblePortalPath {
  return {
    pathId: path.id,
    destinationCellId: path.destinationCellId,
    depth: path.depth,
    rootFromDestinationMatrix: rigidTransformToThreeMatrix(path.rootFromDestination),
    clipPolygonNdc: [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ],
    clipRectNdc: {
      minX: -1,
      minY: -1,
      maxX: 1,
      maxY: 1,
    },
    screenAreaPixels: 1,
  };
}

function cameraLookingAt(
  position: { readonly x: number; readonly y: number; readonly z: number },
  target: { readonly x: number; readonly y: number; readonly z: number },
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100);
  camera.position.copy(worldPointToThree(position));
  camera.lookAt(worldPointToThree(target));
  camera.updateMatrixWorld(true);
  return camera;
}

function destinationLocalPointInRoot(
  path: PortalRenderPath,
  point: { readonly x: number; readonly y: number; readonly z: number },
): { readonly x: number; readonly y: number; readonly z: number } {
  const rootPoint = worldPointToThree(point).applyMatrix4(rigidTransformToThreeMatrix(path.rootFromDestination));
  return {
    x: rootPoint.x,
    y: -rootPoint.z,
    z: rootPoint.y,
  };
}

function singleRoomWorld(): CellComplexSpec {
  return {
    cells: [
      {
        id: "room",
        heightMeters: 3,
        baseVertices: squareBase(),
        portals: [],
      },
    ],
  };
}

function twoRoomPortalWorld(): CellComplexSpec {
  return {
    cells: [
      {
        id: "room-a",
        heightMeters: 3,
        baseVertices: squareBase(),
        portals: [
          {
            id: "north",
            sideIndex: 2,
            targetCellId: "room-b",
            targetPortalId: "south",
          },
        ],
      },
      {
        id: "room-b",
        heightMeters: 3,
        baseVertices: squareBase(),
        portals: [
          {
            id: "south",
            sideIndex: 0,
            targetCellId: "room-a",
            targetPortalId: "north",
          },
        ],
      },
    ],
  };
}

function squareBase(): readonly { readonly x: number; readonly y: number }[] {
  return [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];
}
