import * as THREE from "three";
import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import type { VisiblePortalPath } from "./visiblePortalPaths";

const presentationMatrixCache = new WeakMap<CompiledCellComplex, Map<string, THREE.Matrix4 | undefined>>();

export function applyOrientationCoverPresentationToVisiblePaths(
  world: CompiledCellComplex,
  rootCellId: string,
  paths: readonly VisiblePortalPath[],
): readonly VisiblePortalPath[] {
  if (!world.orientationCover) {
    return paths;
  }

  return paths.map((path) => {
    const presentation = orientationCoverPresentationMatrix(world, rootCellId, path.destinationCellId);

    if (!presentation) {
      return path;
    }

    return {
      ...path,
      rootFromDestinationMatrix: path.rootFromDestinationMatrix.clone().multiply(presentation),
    };
  });
}

export function orientationCoverPresentationMatrix(
  world: CompiledCellComplex,
  rootCellId: string,
  destinationCellId: string,
): THREE.Matrix4 | undefined {
  const cover = world.orientationCover;

  if (!cover) {
    return undefined;
  }

  const rootMetadata = cover.coverCellMetadataById.get(rootCellId);
  const destinationMetadata = cover.coverCellMetadataById.get(destinationCellId);

  if (!rootMetadata || !destinationMetadata || rootMetadata.sheet === destinationMetadata.sheet) {
    return undefined;
  }

  let cache = presentationMatrixCache.get(world);
  if (!cache) {
    cache = new Map();
    presentationMatrixCache.set(world, cache);
  }

  const cacheKey = `${rootMetadata.sheet}->${destinationCellId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const matrix = buildParallelAxisFlipMatrix(world, destinationCellId);
  cache.set(cacheKey, matrix);
  return matrix;
}

function buildParallelAxisFlipMatrix(
  world: CompiledCellComplex,
  coverCellId: string,
): THREE.Matrix4 | undefined {
  const cover = world.orientationCover;
  const metadata = cover?.coverCellMetadataById.get(coverCellId);

  if (!cover || !metadata) {
    return undefined;
  }

  const mirrorSideIndex = cover.mirrorSideIndexByBaseCellId.get(metadata.baseCellId);
  const cell = world.cellsById.get(coverCellId);
  const side = mirrorSideIndex === undefined ? undefined : cell?.sides[mirrorSideIndex];

  if (!cell || !side) {
    return undefined;
  }

  const dx = side.end.x - side.start.x;
  const dy = side.end.y - side.start.y;
  const length = Math.hypot(dx, dy);

  if (length <= 1e-9) {
    return undefined;
  }

  const tangent = new THREE.Vector3(dx / length, 0, -dy / length);
  const sideMidpoint = new THREE.Vector3(
    (side.start.x + side.end.x) / 2,
    0,
    -((side.start.y + side.end.y) / 2),
  );
  const reflection = new THREE.Matrix4().set(
    1 - 2 * tangent.x * tangent.x,
    -2 * tangent.x * tangent.y,
    -2 * tangent.x * tangent.z,
    0,
    -2 * tangent.y * tangent.x,
    1 - 2 * tangent.y * tangent.y,
    -2 * tangent.y * tangent.z,
    0,
    -2 * tangent.z * tangent.x,
    -2 * tangent.z * tangent.y,
    1 - 2 * tangent.z * tangent.z,
    0,
    0,
    0,
    0,
    1,
  );
  const translatedToOrigin = new THREE.Matrix4().makeTranslation(
    -sideMidpoint.x,
    -sideMidpoint.y,
    -sideMidpoint.z,
  );
  const translatedBack = new THREE.Matrix4().makeTranslation(
    sideMidpoint.x,
    sideMidpoint.y,
    sideMidpoint.z,
  );

  return translatedBack.multiply(reflection).multiply(translatedToOrigin);
}
