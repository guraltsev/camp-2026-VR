import type { AuthoredPortalSpec, CellComplexSpec, CellObjectSpec, PortalOrientation, PrismCellSpec } from "./specs";

export type OrientationSheet = "positive" | "negative";

export interface OrientationCoverMetadata {
  readonly baseCellId: string;
  readonly sheet: OrientationSheet;
}

export interface OrientationDoubleCoverResult {
  readonly spec: CellComplexSpec;
  readonly coverCellMetadataById: ReadonlyMap<string, OrientationCoverMetadata>;
  readonly coverCellIdByBaseCellAndSheet: ReadonlyMap<string, string>;
  readonly mirrorSideIndexByBaseCellId: ReadonlyMap<string, number>;
}

export interface PreparedCellComplexSpec {
  readonly spec: CellComplexSpec;
  readonly orientationCover?: OrientationDoubleCoverResult;
}

export const orientationCoverReservedSuffixes = ["#positive", "#negative"] as const;

const sheets = ["positive", "negative"] as const satisfies readonly OrientationSheet[];

export function portalOrientation(portal: AuthoredPortalSpec): PortalOrientation {
  return portal.orientation ?? "preserving";
}

export function hasOrientationReversingPortal(spec: CellComplexSpec): boolean {
  return spec.cells.some((cell) => cell.portals.some((portal) => portalOrientation(portal) === "reversing"));
}

export function prepareWorldForCompilation(spec: CellComplexSpec): PreparedCellComplexSpec {
  if (!hasOrientationReversingPortal(spec)) {
    return { spec };
  }

  const orientationCover = expandOrientationDoubleCover(spec);

  return {
    spec: orientationCover.spec,
    orientationCover,
  };
}

export function expandOrientationDoubleCover(spec: CellComplexSpec): OrientationDoubleCoverResult {
  const coverCellIdByBaseCellAndSheet = new Map<string, string>();
  const coverCellMetadataById = new Map<string, OrientationCoverMetadata>();
  const mirrorSideIndexByBaseCellId = new Map<string, number>();

  for (const cell of spec.cells) {
    const reversingPortal = cell.portals.find((portal) => portalOrientation(portal) === "reversing");
    if (reversingPortal) {
      mirrorSideIndexByBaseCellId.set(cell.id, reversingPortal.sideIndex);
    }

    for (const sheet of sheets) {
      const coverCellId = toCoverCellId(cell.id, sheet);
      coverCellIdByBaseCellAndSheet.set(baseCellSheetKey(cell.id, sheet), coverCellId);
      coverCellMetadataById.set(coverCellId, {
        baseCellId: cell.id,
        sheet,
      });
    }
  }

  const coverCells = spec.cells.flatMap((cell) =>
    sheets.map((sheet): PrismCellSpec => ({
      ...cell,
      id: mustGetCoverCellId(coverCellIdByBaseCellAndSheet, cell.id, sheet),
      baseVertices: [...cell.baseVertices],
      portals: cell.portals.map((portal) =>
        expandPortal(portal, sheet, coverCellIdByBaseCellAndSheet),
      ),
      visuals: cloneVisuals(cell, sheet),
    })),
  );

  return {
    spec: { cells: coverCells },
    coverCellMetadataById,
    coverCellIdByBaseCellAndSheet,
    mirrorSideIndexByBaseCellId,
  };
}

export function getCoverCellId(
  cover: OrientationDoubleCoverResult,
  baseCellId: string,
  sheet: OrientationSheet,
): string | undefined {
  return cover.coverCellIdByBaseCellAndSheet.get(baseCellSheetKey(baseCellId, sheet));
}

export function isOrientationCoverReservedCellId(cellId: string): boolean {
  return orientationCoverReservedSuffixes.some((suffix) => cellId.endsWith(suffix));
}

export function oppositeOrientationSheet(sheet: OrientationSheet): OrientationSheet {
  return sheet === "positive" ? "negative" : "positive";
}

function expandPortal(
  portal: AuthoredPortalSpec,
  sourceSheet: OrientationSheet,
  coverCellIdByBaseCellAndSheet: ReadonlyMap<string, string>,
): AuthoredPortalSpec {
  const targetSheet = portalOrientation(portal) === "reversing"
    ? oppositeOrientationSheet(sourceSheet)
    : sourceSheet;

  return {
    ...portal,
    targetCellId: mustGetCoverCellId(coverCellIdByBaseCellAndSheet, portal.targetCellId, targetSheet),
    orientation: "preserving",
  };
}

function toCoverCellId(baseCellId: string, sheet: OrientationSheet): string {
  return `${baseCellId}#${sheet}`;
}

function baseCellSheetKey(baseCellId: string, sheet: OrientationSheet): string {
  return `${baseCellId}::${sheet}`;
}

function mustGetCoverCellId(
  coverCellIdByBaseCellAndSheet: ReadonlyMap<string, string>,
  baseCellId: string,
  sheet: OrientationSheet,
): string {
  const coverCellId = coverCellIdByBaseCellAndSheet.get(baseCellSheetKey(baseCellId, sheet));

  if (!coverCellId) {
    throw new Error(`Missing orientation cover cell for "${baseCellId}" on ${sheet} sheet.`);
  }

  return coverCellId;
}

function cloneVisuals(cell: PrismCellSpec, sheet: OrientationSheet): PrismCellSpec["visuals"] {
  if (!cell.visuals) {
    return undefined;
  }

  return {
    ...cell.visuals,
    objects: cell.visuals.objects?.map((object) => cloneObjectForSheet(object, sheet)),
  };
}

function cloneObjectForSheet(object: CellObjectSpec, sheet: OrientationSheet): CellObjectSpec {
  return {
    ...object,
    id: `${object.id}#${sheet}`,
  };
}
