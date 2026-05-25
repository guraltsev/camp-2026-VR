import type { CompiledPortal } from "./specs";

export function describePortalTransform(portal: CompiledPortal): string {
  return `${portal.id} -> ${portal.targetCellId}:${portal.targetPortalId}`;
}
