import * as THREE from "three";
import { patchPortalClipMaterial, type PortalClipMaterialState } from "./portalClipMaterial";
import type { RuntimeObjectRenderRecord, RuntimeObjectRenderSourceMesh } from "./runtimeObjectRenderRecords";

export interface RuntimeObjectRenderArchetype {
  readonly archetypeKey: string;
  readonly mesh: THREE.InstancedMesh;
  readonly portalPathIdAttribute: THREE.InstancedBufferAttribute;
  readonly portalClipIndexAttribute: THREE.InstancedBufferAttribute;
  readonly capacity: number;
  readonly sourceObjectId: string;
}

export interface RuntimeObjectRenderArchetypeDiagnostics {
  reset(): void;
  recordCapacityOverflow(archetype: RuntimeObjectRenderArchetype, requestedCount: number): void;
  readonly capacityOverflowArchetypes: readonly string[];
  readonly capacityOverflowCount: number;
}

export function createRuntimeObjectRenderArchetypeDiagnostics(): RuntimeObjectRenderArchetypeDiagnostics {
  const capacityOverflowArchetypes = new Set<string>();

  return {
    reset() {
      capacityOverflowArchetypes.clear();
    },
    recordCapacityOverflow(archetype) {
      capacityOverflowArchetypes.add(archetype.archetypeKey);
    },
    get capacityOverflowArchetypes() {
      return [...capacityOverflowArchetypes].sort();
    },
    get capacityOverflowCount() {
      return capacityOverflowArchetypes.size;
    },
  };
}

export function buildRuntimeObjectRenderArchetype(
  source: RuntimeObjectRenderSourceMesh,
  capacity: number,
  portalClipMaterialState: PortalClipMaterialState | undefined,
): RuntimeObjectRenderArchetype {
  const geometry = source.mesh.geometry.clone();
  const rootFromWorld = new THREE.Matrix4().copy(source.root.matrixWorld).invert();
  geometry.applyMatrix4(rootFromWorld.multiply(source.mesh.matrixWorld));

  const material = cloneMaterial(source.mesh.material);
  const clippedMaterial = portalClipMaterialState ? patchPortalClipMaterial(material, portalClipMaterialState) : material;
  const mesh = new THREE.InstancedMesh(geometry, clippedMaterial, capacity);
  const portalPathIdAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const portalClipIndexAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);

  mesh.name = `runtime-object-archetype:${source.archetypeKey}`;
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  portalPathIdAttribute.setUsage(THREE.DynamicDrawUsage);
  portalClipIndexAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("portalPathId", portalPathIdAttribute);
  geometry.setAttribute("portalClipIndex", portalClipIndexAttribute);
  mesh.userData = {
    kind: "runtime-object-render-archetype",
    objectId: source.objectId,
    archetypeKey: source.archetypeKey,
  };

  return {
    archetypeKey: source.archetypeKey,
    mesh,
    portalPathIdAttribute,
    portalClipIndexAttribute,
    capacity,
    sourceObjectId: source.objectId,
  };
}

export function disposeRuntimeObjectRenderArchetypes(
  archetypes: Iterable<RuntimeObjectRenderArchetype>,
): void {
  for (const archetype of archetypes) {
    archetype.mesh.geometry.dispose();
    disposeMaterial(archetype.mesh.material);
  }
}

export function groupRuntimeObjectRenderRecordsByArchetype(
  records: readonly RuntimeObjectRenderRecord[],
): ReadonlyMap<string, readonly RuntimeObjectRenderRecord[]> {
  const grouped = new Map<string, RuntimeObjectRenderRecord[]>();

  for (const record of records) {
    const existing = grouped.get(record.archetypeKey);
    if (existing) {
      existing.push(record);
    } else {
      grouped.set(record.archetypeKey, [record]);
    }
  }

  return grouped;
}

export function deriveRuntimeObjectRenderArchetypeCapacity(
  recordCount: number,
  maxVisiblePaths: number,
): number {
  return Math.max(1, recordCount * maxVisiblePaths);
}

function cloneMaterial(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((entry) => entry.clone());
  }

  return material.clone();
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      entry.dispose();
    }
    return;
  }

  material.dispose();
}
