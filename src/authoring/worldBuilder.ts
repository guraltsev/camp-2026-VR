import type {
  AuthoredPortalSpec,
  CellComplexSpec,
  CellObjectSpec,
  FloorMaterialSpec,
  PortalOrientation,
  PrismCellSpec,
} from "../cell-complex/specs";
import { createConvexPrismBaseVertices, type ConvexPrismBaseVertices } from "../cell-complex/prismBase";
import { isWorldLibraryObjectSpec, type WorldLibraryObjectSpec } from "../world-objects/library";
import { normalizeFloorMaterial, type WorldFloorMaterialSpec } from "../world-assets/floorTextures";

const defaultHeightMeters = 15;

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
  Portal(face1: string, side1: number, face2: string, side2: number, options?: PortalOptions): void;
  FlippedPortal(face1: string, side1: number, face2: string, side2: number): void;
  OnFace(faceName: string, objects: readonly WorldLibraryObjectSpec[]): void;
  build(): CellComplexSpec;
}

export interface PortalOptions {
  readonly orientation?: PortalOrientation;
}

export function createWorldBuilder(): WorldBuilder {
  const cells = new Map<string, MutableCell>();
  const portalAssignments = new Map<string, Set<string>>();
  const objectIds = new Set<string>();

  function addPortal(face1: string, side1: number, face2: string, side2: number, options: PortalOptions = {}): void {
    const cell1 = cells.get(face1);
    const cell2 = cells.get(face2);
    const orientation = normalizePortalOrientation(options.orientation);

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
      orientation,
    });
    cell2.portals.push({
      id: authoredSide2.portalId,
      sideIndex: authoredSide2.sideIndex,
      targetCellId: face1,
      targetPortalId: authoredSide1.portalId,
      orientation,
    });
    portalAssignments.get(face1)?.add(authoredSide1.portalId);
    portalAssignments.get(face2)?.add(authoredSide2.portalId);
  }

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

    Portal(face1, side1, face2, side2, options = {}) {
      addPortal(face1, side1, face2, side2, options);
    },

    FlippedPortal(face1, side1, face2, side2) {
      addPortal(face1, side1, face2, side2, { orientation: "reversing" });
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

function normalizePortalOrientation(orientation: PortalOrientation | undefined): PortalOrientation {
  return orientation ?? "preserving";
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
