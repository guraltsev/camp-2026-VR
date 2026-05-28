import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { CellRenderArchetype } from "../../src/render/three/cellRenderArchetypes";
import { createPortalInstanceDebugRenderer } from "../../src/render/three/portalInstanceDebug";
import {
  createPortalInstanceDiagnostics,
  createPortalInstanceRenderDebugState,
  createRootVisiblePortalPath,
  groupVisiblePortalPathsByDestinationCell,
  updateCellRenderArchetypeInstances,
} from "../../src/render/three/renderPortalInstances";

describe("updateCellRenderArchetypeInstances", () => {
  it("writes root and duplicate destination matrices, caps counts, and reports overflow", () => {
    const roomA = createArchetype("room-a", "room-a:floor:0", 1);
    const roomB = createArchetype("room-b", "room-b:floor:0", 1);
    const roomBWall = createArchetype("room-b", "room-b:wall:1", 1);
    const diagnostics = createPortalInstanceDiagnostics();
    const duplicateTransform = new THREE.Matrix4().makeTranslation(4, 0, 0);
    const visiblePaths = groupVisiblePortalPathsByDestinationCell([
      createRootVisiblePortalPath("room-a"),
      {
        ...createRootVisiblePortalPath("room-b"),
        pathId: 1,
      },
      {
        ...createRootVisiblePortalPath("room-b"),
        pathId: 2,
        rootFromDestinationMatrix: duplicateTransform,
      },
    ]);

    updateCellRenderArchetypeInstances([roomA, roomB, roomBWall], visiblePaths, diagnostics);

    expect(roomA.mesh.count).toBe(1);
    expect(roomB.mesh.count).toBe(1);
    expect(roomBWall.mesh.count).toBe(1);
    expect(readMatrix(roomA.mesh, 0)).toEqual(new THREE.Matrix4().elements);
    expect(readMatrix(roomB.mesh, 0)).toEqual(new THREE.Matrix4().elements);
    expect(diagnostics.capacityOverflowCount).toBe(2);
    expect(diagnostics.capacityOverflowArchetypes).toEqual(["room-b:floor:0", "room-b:wall:1"]);

    const debugState = createPortalInstanceRenderDebugState([roomA, roomB, roomBWall], visiblePaths, diagnostics, {
      enabled: true,
      showCellPathRendersInstances: true,
    });

    expect(debugState.ShowCellPathRendersInstances).toBe(true);
    expect(debugState.renderedInstanceCount).toBe(3);
    expect(debugState.renderedInstanceCountByCell).toEqual([
      { cellId: "room-a", count: 1 },
      { cellId: "room-b", count: 2 },
    ]);
  });
});

describe("createPortalInstanceDebugRenderer", () => {
  it("renders one debug instance per archetype for a selected cell and clears them on demand", () => {
    const scene = new THREE.Scene();
    const debugRenderer = createPortalInstanceDebugRenderer(scene, [
      createArchetype("room-a", "room-a:floor:0", 2),
      createArchetype("room-a", "room-a:wall:1", 2),
      createArchetype("room-b", "room-b:floor:0", 2),
    ]);

    const renderResult = debugRenderer.renderCellInstances(
      "room-a",
      new THREE.Matrix4().makeTranslation(1, 2, 3),
    );

    expect(renderResult.objectCount).toBe(2);
    expect(scene.getObjectByName("portal-instance-debug")?.children).toHaveLength(2);

    debugRenderer.clear();

    expect(scene.getObjectByName("portal-instance-debug")?.children).toHaveLength(0);
    debugRenderer.dispose();
  });
});

function createArchetype(cellId: string, archetypeId: string, capacity: number): CellRenderArchetype {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
    capacity,
  );
  mesh.count = 0;

  return {
    cellId,
    archetypeId,
    kind: "static-object",
    mesh,
    capacity,
  };
}

function readMatrix(mesh: THREE.InstancedMesh, index: number): readonly number[] {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix.elements;
}
