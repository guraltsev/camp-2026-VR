import * as THREE from "three";

export interface RuntimeObjectRenderRecord {
  readonly objectId: string;
  readonly cellId: string;
  readonly archetypeKey: string;
  readonly localMatrix: THREE.Matrix4;
  readonly omitRootVisiblePath?: boolean;
}

export interface RuntimeObjectRenderSourceMesh {
  readonly objectId: string;
  readonly archetypeKey: string;
  readonly mesh: THREE.Mesh;
  readonly root: THREE.Object3D;
}

export function collectRuntimeObjectRenderSourceMeshes(
  objectId: string,
  root: THREE.Object3D,
  archetypeKeyPrefix: string,
): readonly RuntimeObjectRenderSourceMesh[] {
  root.updateMatrixWorld(true);
  const sources: RuntimeObjectRenderSourceMesh[] = [];
  let meshIndex = 0;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    sources.push({
      objectId,
      archetypeKey: `${archetypeKeyPrefix}:mesh:${meshIndex}`,
      mesh: child,
      root,
    });
    child.visible = false;
    meshIndex += 1;
  });

  return sources;
}
