import type {
  AuthoredPortalSpec,
  CellComplexSpec,
  CellObjectSpec,
  FloorMaterialSpec,
  PrismCellSpec,
  StartingPositionSpec,
} from "../cell-complex/specs";
import { createConvexPrismBaseVertices, type ConvexPrismBaseVertices } from "../cell-complex/prismBase";
import { isWorldLibraryObjectSpec, type WorldLibraryObjectSpec } from "../world-objects/library";
import { normalizeFloorMaterial, type WorldFloorMaterialSpec } from "../world-assets/floorTextures";
import { worldObjectLibrary } from "../world-objects/library";
import { degreesToRadians, type StaticObjectAuthoringParams } from "../world-objects/staticAssets";

const defaultHeightMeters = 15;
const startingHouseLookOffsetDegrees = 12;
export const defaultStartingQuestionCubeMessage =
  "Move with Arrow keys or the left stick. Look at nearby objects for prompts. Use primary action or trigger for the selected action. Use context action or side trigger for tools and object menus. Press H or B while aiming at an object for its help.";

interface MutableCell {
  readonly id: string;
  readonly heightMeters: number;
  readonly baseVertices: readonly { readonly x: number; readonly y: number }[];
  readonly portals: AuthoredPortalSpec[];
  readonly visuals: {
    floorColor: string;
    floorMaterial: FloorMaterialSpec;
    objects: CellObjectSpec[];
  };
}

export interface WorldBuilder {
  PolygonFace(name: string, floor: string | WorldFloorMaterialSpec, vertices: ConvexPrismBaseVertices): void;
  Portal(face1: string, side1: number, face2: string, side2: number): void;
  OnFace(faceName: string, objects: readonly WorldLibraryObjectSpec[]): void;
  startingHouse(faceName: string, params: StaticObjectAuthoringParams): void;
  startingQuestionCube(faceName: string, params: StartingQuestionCubeAuthoringParams): void;
  startingPosition(faceName: string, params: StartingPositionAuthoringParams): void;
  build(): CellComplexSpec;
}

export interface StartingQuestionCubeAuthoringParams extends StaticObjectAuthoringParams {
  readonly message?: string;
}

export interface StartingPositionAuthoringParams {
  /**
   * Position in authored [x, height, y] axes, matching object library positions.
   */
  readonly position: readonly [x: number, height: number, y: number];
  readonly turn?: number;
  readonly pitch?: number;
}

export function createWorldBuilder(): WorldBuilder {
  const cells = new Map<string, MutableCell>();
  const portalAssignments = new Map<string, Set<string>>();
  const objectIds = new Set<string>();
  let startingPosition: StartingPositionSpec | undefined;

  return {
    PolygonFace(name, floor, vertices) {
      if (cells.has(name)) {
        throw new Error(`Duplicate face "${name}".`);
      }

      if (!Array.isArray(vertices) || vertices.length < 3) {
        throw new Error(`PolygonFace("${name}") requires at least 3 vertices.`);
      }

      const validatedVertices = createConvexPrismBaseVertices(vertices);
      const normalizedVertices = validatedVertices.map((vertex, index) => normalizeVertex(name, vertex, index));
      const floorMaterial = normalizeFloorMaterial(floor);

      cells.set(name, {
        id: name,
        heightMeters: defaultHeightMeters,
        baseVertices: normalizedVertices,
        portals: [],
        visuals: {
          floorColor: floorMaterial.floorColor,
          floorMaterial,
          objects: [],
        },
      });
      portalAssignments.set(name, new Set());
    },

    Portal(face1, side1, face2, side2) {
      const cell1 = cells.get(face1);
      const cell2 = cells.get(face2);

      if (!cell1) {
        throw new Error(`Unknown face "${face1}" in Portal().`);
      }

      if (!cell2) {
        throw new Error(`Unknown face "${face2}" in Portal().`);
      }

      const authoredSide1 = normalizeSideIndex(side1, cell1.baseVertices.length);
      const authoredSide2 = normalizeSideIndex(side2, cell2.baseVertices.length);

      if (face1 === face2 && authoredSide1.portalId === authoredSide2.portalId) {
        throw new Error(`Portal("${face1}", ${side1}, ...) cannot connect a side to itself.`);
      }

      assertUnassignedSide(portalAssignments, face1, authoredSide1.portalId);
      assertUnassignedSide(portalAssignments, face2, authoredSide2.portalId);

      cell1.portals.push({
        id: authoredSide1.portalId,
        sideIndex: authoredSide1.sideIndex,
        targetCellId: face2,
        targetPortalId: authoredSide2.portalId,
      });
      cell2.portals.push({
        id: authoredSide2.portalId,
        sideIndex: authoredSide2.sideIndex,
        targetCellId: face1,
        targetPortalId: authoredSide1.portalId,
      });
      portalAssignments.get(face1)?.add(authoredSide1.portalId);
      portalAssignments.get(face2)?.add(authoredSide2.portalId);
    },

    OnFace(faceName, objects) {
      const cell = cells.get(faceName);

      if (!cell) {
        throw new Error(`Unknown face "${faceName}" in OnFace().`);
      }

      if (!Array.isArray(objects)) {
        throw new Error(`OnFace("${faceName}", ...) requires an array of objects.`);
      }

      for (const object of objects) {
        if (!isWorldLibraryObjectSpec(object)) {
          throw new Error(`OnFace("${faceName}", ...) received an object that was not created by the object library.`);
        }

        if (objectIds.has(object.id)) {
          throw new Error(`Duplicate object id "${object.id}".`);
        }

        objectIds.add(object.id);
        cell.visuals.objects.push(stripLibraryBrand(object));
      }
    },

    startingHouse(faceName, params) {
      const cell = requireCell(cells, faceName, "startingHouse");

      if (objectIds.has("startingHouse")) {
        throw new Error('Duplicate object id "startingHouse".');
      }

      const house = worldObjectLibrary.small_house("startingHouse", params);
      objectIds.add(house.id);
      cell.visuals.objects.push(stripLibraryBrand(house));
      startingPosition = createStartingPositionInFrontOfHouse(faceName, params);
    },

    startingQuestionCube(faceName, params) {
      const cell = requireCell(cells, faceName, "startingQuestionCube");

      if (objectIds.has("startingQuestionCube")) {
        throw new Error('Duplicate object id "startingQuestionCube".');
      }

      const questionCube = worldObjectLibrary.question_cube("startingQuestionCube", {
        ...params,
        displayHelpMessage: params.message ?? params.displayHelpMessage ?? defaultStartingQuestionCubeMessage,
      });
      objectIds.add(questionCube.id);
      cell.visuals.objects.push(stripLibraryBrand(questionCube));
    },

    startingPosition(faceName, params) {
      requireCell(cells, faceName, "startingPosition");
      startingPosition = {
        cellId: faceName,
        position: authorPositionToWorld(params.position),
        yawRadians: degreesToRadians(params.turn ?? 0),
        pitchRadians: degreesToRadians(params.pitch ?? 0),
      };
    },

    build() {
      return {
        cells: [...cells.values()].map((cell): PrismCellSpec => ({
          id: cell.id,
          heightMeters: cell.heightMeters,
          baseVertices: [...cell.baseVertices],
          portals: [...cell.portals],
          visuals: {
            floorColor: cell.visuals.floorColor,
            floorMaterial: cell.visuals.floorMaterial,
            objects: [...cell.visuals.objects],
          },
        })),
        startingPosition,
      };
    },
  };
}

export function authorSideToSideIndex(vertexCount: number, side: number): number {
  if (!Number.isInteger(side)) {
    throw new Error(`Invalid side ${String(side)}; side index must be an integer.`);
  }

  if (side < 0 || side >= vertexCount) {
    throw new Error(`Invalid side ${side}; expected an index in the range 0-${vertexCount - 1}.`);
  }

  return side;
}

function normalizeVertex(faceName: string, vertex: readonly number[], index: number): { readonly x: number; readonly y: number } {
  if (!Array.isArray(vertex) || vertex.length !== 2) {
    throw new Error(`PolygonFace("${faceName}") vertex ${index} must be a [x, y] pair.`);
  }

  const [x, y] = vertex;

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`PolygonFace("${faceName}") vertex ${index} must contain finite numbers.`);
  }

  return { x, y };
}

function normalizeSideIndex(side: number, vertexCount: number): { readonly sideIndex: number; readonly portalId: string } {
  const sideIndex = authorSideToSideIndex(vertexCount, side);
  return {
    sideIndex,
    portalId: `side-${sideIndex}`,
  };
}

function assertUnassignedSide(
  portalAssignments: ReadonlyMap<string, ReadonlySet<string>>,
  faceName: string,
  portalId: string,
): void {
  if (portalAssignments.get(faceName)?.has(portalId)) {
    throw new Error(`Face "${faceName}" already has a portal on ${portalId}.`);
  }
}

function stripLibraryBrand(object: WorldLibraryObjectSpec): CellObjectSpec {
  return { ...object };
}

function requireCell(
  cells: ReadonlyMap<string, MutableCell>,
  faceName: string,
  callerName: string,
): MutableCell {
  const cell = cells.get(faceName);

  if (!cell) {
    throw new Error(`Unknown face "${faceName}" in ${callerName}().`);
  }

  return cell;
}

function createStartingPositionInFrontOfHouse(
  faceName: string,
  params: StaticObjectAuthoringParams,
): StartingPositionSpec {
  const housePosition = authorPositionToWorld(params.position);
  const yawRadians = degreesToRadians(params.turn ?? 0);
  const playerYawRadians = yawRadians + Math.PI - degreesToRadians(startingHouseLookOffsetDegrees);
  const scale = params.scale ?? 1;
  const distanceMeters = 2.15 * scale + 0.55;

  return {
    cellId: faceName,
    position: {
      x: housePosition.x - Math.sin(yawRadians) * distanceMeters,
      y: housePosition.y + Math.cos(yawRadians) * distanceMeters,
      z: housePosition.z,
    },
    yawRadians: playerYawRadians,
    pitchRadians: 0,
  };
}

function authorPositionToWorld(
  position: readonly [x: number, height: number, y: number],
): StartingPositionSpec["position"] {
  return {
    x: position[0],
    y: position[2],
    z: position[1],
  };
}
