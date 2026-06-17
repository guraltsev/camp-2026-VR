import type { AuthoredPortalSpec, CellComplexSpec, PrismCellSpec } from "./specs";
import { hasOrientationReversingPortal, portalOrientation } from "./orientationDoubleCover";

export function describeGeometrySpec(spec: CellComplexSpec): string {
  const lines = [`Ingested geometry: ${spec.cells.length} cell${spec.cells.length === 1 ? "" : "s"}.`];
  lines.push(`Orientation cover: ${hasOrientationReversingPortal(spec) ? "will expand" : "not needed"}.`);

  lines.push("Cells:");

  for (const cell of spec.cells) {
    const floorColor = cell.visuals?.floorColor ?? "default";
    const objectCount = cell.visuals?.objects?.length ?? 0;
    lines.push(`- cell=${cell.id}: prism, sides=${cell.baseVertices.length}, floor=${floorColor}, objects=${objectCount}`);
  }

  lines.push("Connections:");

  const connections = spec.cells.flatMap((cell) =>
    cell.portals.map((portal) => describePortalConnection(cell, portal, spec)),
  );

  if (connections.length === 0) {
    lines.push("- none");
  } else {
    lines.push(...connections.map((connection) => `- ${connection}`));
  }

  return lines.join("\n");
}

function describePortalConnection(sourceCell: PrismCellSpec, portal: AuthoredPortalSpec, spec: CellComplexSpec): string {
  const targetCell = spec.cells.find((cell) => cell.id === portal.targetCellId);
  const targetPortal = targetCell?.portals.find((candidate) => candidate.id === portal.targetPortalId);
  const sourceSide = formatSide(portal.sideIndex);
  const targetSide = targetCell && targetPortal ? formatSide(targetPortal.sideIndex) : `portal=${portal.targetPortalId}`;
  const orientation = portalOrientation(portal) === "reversing" ? ", orientation=reversing" : "";

  return `(cell=${sourceCell.id}, side=${sourceSide}) -> (cell=${portal.targetCellId}, side=${targetSide}${orientation})`;
}

function formatSide(sideIndex: number): string {
  return String(sideIndex);
}
