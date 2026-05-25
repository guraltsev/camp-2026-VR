import type { CellComplexSpec } from "./cell-complex/specs";

interface GeometryModule {
  readonly [exportName: string]: unknown;
}

export interface GeometryOption {
  readonly id: string;
  readonly file: string;
  readonly label: string;
}

export interface GeometrySelectionOptions {
  readonly selectedGeometryId: string;
  readonly renderPicker: boolean;
  readonly debugLevel: number;
}

const geometryModules = import.meta.glob<GeometryModule>("./cell-complex/examples/*.ts");

export const defaultGeometryId = "twoPrismLoop";

export const availableGeometries: readonly GeometryOption[] = Object.keys(geometryModules)
  .map((file) => {
    const id = file.split("/").pop()?.replace(/\.ts$/, "") ?? file;

    return {
      id,
      file,
      label: humanizeGeometryId(id),
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

export function readGeometrySelectionOptions(location: Location): GeometrySelectionOptions {
  const params = new URLSearchParams(location.search);
  const requestedGeometryId = normalizeRequestedGeometryId(params.get("geometry")) ?? defaultGeometryId;
  const selectedGeometryId = findGeometryOption(requestedGeometryId)?.id ?? defaultGeometryId;

  return {
    selectedGeometryId,
    renderPicker: !isDisabled(params.get("geometryPicker")),
    debugLevel: readIntegerParam(params.get("debug")),
  };
}

export async function loadGeometrySpec(geometryId: string): Promise<CellComplexSpec> {
  const option = findGeometryOption(geometryId) ?? findGeometryOption(defaultGeometryId);

  if (!option) {
    throw new Error("No geometry specs are available.");
  }

  const loadModule = geometryModules[option.file];

  if (!loadModule) {
    throw new Error(`Geometry spec is registered but cannot be loaded: ${option.file}`);
  }

  return findCellComplexSpec(await loadModule(), option.id);
}

export function renderGeometryPicker(container: HTMLElement, selectedGeometryId: string): void {
  const picker = document.createElement("select");
  picker.ariaLabel = "Geometry";
  picker.title = "Geometry";
  picker.className = "geometry-picker";

  for (const option of availableGeometries) {
    const item = document.createElement("option");
    item.value = option.id;
    item.textContent = option.label;
    item.selected = option.id === selectedGeometryId;
    picker.append(item);
  }

  picker.addEventListener("change", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("geometry", picker.value);
    url.searchParams.set("geometryPicker", "1");
    window.location.assign(url);
  });

  container.append(picker);
}

function findGeometryOption(geometryId: string): GeometryOption | undefined {
  const normalized = normalizeRequestedGeometryId(geometryId);
  return availableGeometries.find((option) => option.id === normalized);
}

function normalizeRequestedGeometryId(rawValue: string | null): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  const fileName = rawValue.split(/[\\/]/).pop() ?? rawValue;
  return fileName.replace(/\.ts$/, "");
}

function isDisabled(rawValue: string | null): boolean {
  return rawValue === "0" || rawValue === "false" || rawValue === "no";
}

function readIntegerParam(rawValue: string | null): number {
  if (!rawValue) {
    return 0;
  }

  const value = Number.parseInt(rawValue, 10);
  return Number.isFinite(value) ? value : 0;
}

function findCellComplexSpec(module: GeometryModule, geometryId: string): CellComplexSpec {
  const preferredExport = module[geometryId];

  if (isCellComplexSpec(preferredExport)) {
    return preferredExport;
  }

  for (const exportedValue of Object.values(module)) {
    if (isCellComplexSpec(exportedValue)) {
      return exportedValue;
    }
  }

  throw new Error(`Geometry module "${geometryId}" does not export a CellComplexSpec.`);
}

function isCellComplexSpec(value: unknown): value is CellComplexSpec {
  return typeof value === "object" && value !== null && Array.isArray((value as CellComplexSpec).cells);
}

function humanizeGeometryId(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
