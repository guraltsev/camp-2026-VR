import * as THREE from "three";
import type { CellRenderArchetype } from "./cellRenderArchetypes";

export interface PortalInstanceDebugRenderer {
  renderCellInstances(cellId: string, rootFromDestinationMatrix: THREE.Matrix4): { readonly objectCount: number };
  clear(): void;
  dispose(): void;
}

export function createPortalInstanceDebugRenderer(
  scene: THREE.Scene,
  archetypes: readonly CellRenderArchetype[],
): PortalInstanceDebugRenderer {
  const group = new THREE.Group();
  group.name = "portal-instance-debug";
  scene.add(group);

  return {
    renderCellInstances(cellId, rootFromDestinationMatrix) {
      clearGroup(group);
      const matchingArchetypes = archetypes.filter((archetype) => archetype.cellId === cellId);

      for (const archetype of matchingArchetypes) {
        const mesh = new THREE.InstancedMesh(
          archetype.mesh.geometry.clone(),
          cloneMaterial(archetype.mesh.material),
          1,
        );
        mesh.name = `debug:${archetype.archetypeId}`;
        mesh.count = 1;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.setMatrixAt(0, rootFromDestinationMatrix);
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
      }

      return {
        objectCount: matchingArchetypes.length,
      };
    },
    clear() {
      clearGroup(group);
    },
    dispose() {
      clearGroup(group);
      group.removeFromParent();
    },
  };
}

function clearGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }

      node.geometry.dispose();
      disposeMaterial(node.material);
    });
  }
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
