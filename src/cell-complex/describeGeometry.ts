import type { CellComplexSpec, PortalSpec, PrismCellSpec } from "./specs";

export function describeGeometrySpec(spec: CellComplexSpec): string {
  const lines = [`Ingested geometry: ${spec.cells.length} cell${spec.cells.length === 1 ? "" : "s"}.`];

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

function describePortalConnection(sourceCell: PrismCellSpec, portal: PortalSpec, spec: CellComplexSpec): string {
  const targetCell = spec.cells.find((cell) => cell.id === portal.targetCellId);
  const targetPortal = targetCell?.portals.find((candidate) => candidate.id === portal.targetPortalId);
  const sourceSide = formatForwardSide(portal.sideIndex, sourceCell.baseVertices.length);
  const targetSide = targetCell && targetPortal
    ? formatReversedSide(targetPortal.sideIndex, targetCell.baseVertices.length)
    : `portal=${portal.targetPortalId}`;

  return `(cell=${sourceCell.id}, side=${sourceSide}) -> (cell=${portal.targetCellId}, side=${targetSide})`;
}

function formatForwardSide(sideIndex: number, sideCount: number): string {
  return `(${sideIndex},${nextSideVertex(sideIndex, sideCount)})`;
}

function formatReversedSide(sideIndex: number, sideCount: number): string {
  return `(${nextSideVertex(sideIndex, sideCount)},${sideIndex})`;
}

function nextSideVertex(sideIndex: number, sideCount: number): number {
  return (sideIndex + 1) % sideCount;
}
