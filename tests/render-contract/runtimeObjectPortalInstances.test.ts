import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createRootVisiblePortalPath, updateRuntimeObjectRenderArchetypeInstances } from "../../src/render/three/renderPortalInstances";
import {
  createRuntimeObjectRenderArchetypeDiagnostics,
  groupRuntimeObjectRenderRecordsByArchetype,
  type RuntimeObjectRenderArchetype,
} from "../../src/render/three/runtimeObjectRenderArchetypes";
import type { RuntimeObjectRenderRecord } from "../../src/render/three/runtimeObjectRenderRecords";

describe("updateRuntimeObjectRenderArchetypeInstances", () => {
  it("groups records by archetype and composes visible path matrices with record local matrices", () => {
    const archetype = createArchetype("mouse-body", 4);
    const diagnostics = createRuntimeObjectRenderArchetypeDiagnostics();
    const recordMatrix = new THREE.Matrix4().makeTranslation(1, 2, 3);
    const pathMatrix = new THREE.Matrix4().makeTranslation(10, 20, 30);
    const records: RuntimeObjectRenderRecord[] = [
      {
        objectId: "mouse-a",
        cellId: "room-b",
        archetypeKey: "mouse-body",
        localMatrix: recordMatrix,
      },
    ];

    updateRuntimeObjectRenderArchetypeInstances(
      [archetype],
      groupRuntimeObjectRenderRecordsByArchetype(records),
      new Map([
        [
          "room-b",
          [
            {
              ...createRootVisiblePortalPath("room-b"),
              depth: 1,
              pathId: 7,
              rootFromDestinationMatrix: pathMatrix,
            },
          ],
        ],
      ]),
      diagnostics,
      new Map([[7, 3]]),
    );

    expect(archetype.mesh.count).toBe(1);
    expect(readMatrix(archetype.mesh, 0)).toEqual(new THREE.Matrix4().multiplyMatrices(pathMatrix, recordMatrix).elements);
    expect(archetype.portalPathIdAttribute.getX(0)).toBe(7);
    expect(archetype.portalClipIndexAttribute.getX(0)).toBe(3);
    expect(diagnostics.capacityOverflowCount).toBe(0);
  });

  it("reports overflow when matching records and paths exceed archetype capacity", () => {
    const archetype = createArchetype("flag-text", 1);
    const diagnostics = createRuntimeObjectRenderArchetypeDiagnostics();
    const records: RuntimeObjectRenderRecord[] = [
      {
        objectId: "flag-a",
        cellId: "room-a",
        archetypeKey: "flag-text",
        localMatrix: new THREE.Matrix4(),
      },
    ];

    updateRuntimeObjectRenderArchetypeInstances(
      [archetype],
      groupRuntimeObjectRenderRecordsByArchetype(records),
      new Map([
        [
          "room-a",
          [
            createRootVisiblePortalPath("room-a"),
            {
              ...createRootVisiblePortalPath("room-a"),
              depth: 1,
              pathId: 2,
            },
          ],
        ],
      ]),
      diagnostics,
    );

    expect(archetype.mesh.count).toBe(1);
    expect(diagnostics.capacityOverflowCount).toBe(1);
    expect(diagnostics.capacityOverflowArchetypes).toEqual(["flag-text"]);
  });
});

function createArchetype(archetypeKey: string, capacity: number): RuntimeObjectRenderArchetype {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
    capacity,
  );
  const portalPathIdAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const portalClipIndexAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  mesh.geometry.setAttribute("portalPathId", portalPathIdAttribute);
  mesh.geometry.setAttribute("portalClipIndex", portalClipIndexAttribute);

  return {
    archetypeKey,
    mesh,
    portalPathIdAttribute,
    portalClipIndexAttribute,
    capacity,
    sourceObjectId: "source",
  };
}

function readMatrix(mesh: THREE.InstancedMesh, index: number): readonly number[] {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix.elements;
}
