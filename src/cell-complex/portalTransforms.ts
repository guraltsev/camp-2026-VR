import type { PortalSpec } from "./specs";

export function describePortalTransform(portal: PortalSpec): string {
  return `${portal.id} -> ${portal.targetCellId}:${portal.targetPortalId}`;
}
