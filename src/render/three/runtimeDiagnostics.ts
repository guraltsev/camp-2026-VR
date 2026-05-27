import type { CompiledCellComplex } from "../../cell-complex/compileCellComplex";
import { isVerboseDebugLevel, type DebugLevelId } from "../../glue/debugLevels";

type AssetPhase = "preload" | "instance-load";

interface AssetDebugRecord {
  readonly assetPath: string;
  readonly objectId: string;
  readonly cellId: string;
  readonly kind: string;
  readonly phase: AssetPhase;
  startTimeMs?: number;
  endTimeMs?: number;
  status: "pending" | "loaded" | "error";
}

interface CellDebugSummary {
  readonly cellId: string;
  readonly assetUses: readonly {
    readonly objectId: string;
    readonly kind: string;
    readonly assetPath: string;
  }[];
  firstEnteredAtMs?: number;
}

interface PortalTransitionEvent {
  readonly atMs: number;
  readonly fromCellId: string;
  readonly toCellId: string;
  readonly portalId: string;
}

interface RuntimeDiagnosticsSnapshot {
  readonly enabled: boolean;
  readonly startedAtIso: string;
  readonly cellSummaries: readonly CellDebugSummary[];
  readonly assetRecords: readonly AssetDebugRecord[];
  readonly transitions: readonly PortalTransitionEvent[];
  readonly recentEvents: readonly string[];
}

interface RuntimeDiagnosticsApi {
  readonly enabled: boolean;
  recordPreloadStart(assetPath: string, kind: string): void;
  recordPreloadComplete(assetPath: string, kind: string): void;
  recordPreloadError(assetPath: string, kind: string, error?: unknown): void;
  recordAssetInstanceStart(cellId: string, objectId: string, assetPath: string, kind: string): void;
  recordAssetInstanceComplete(cellId: string, objectId: string, assetPath: string, kind: string): void;
  recordAssetInstanceError(cellId: string, objectId: string, assetPath: string, kind: string, error?: unknown): void;
  recordCellEntered(fromCellId: string, toCellId: string, portalId: string): void;
  recordWarmup(reason: string, durationMs: number): void;
  recordFrame(
    cellId: string,
    timings: {
      readonly totalMs: number;
      readonly moveMs: number;
      readonly renderMs: number;
    },
  ): void;
  snapshot(): RuntimeDiagnosticsSnapshot;
  dispose(): void;
}

declare global {
  interface Window {
    __noneuclidDiagnostics?: RuntimeDiagnosticsSnapshot;
  }
}

const noopDiagnostics: RuntimeDiagnosticsApi = {
  enabled: false,
  recordPreloadStart() {},
  recordPreloadComplete() {},
  recordPreloadError() {},
  recordAssetInstanceStart() {},
  recordAssetInstanceComplete() {},
  recordAssetInstanceError() {},
  recordCellEntered() {},
  recordWarmup() {},
  recordFrame() {},
  snapshot() {
    return {
      enabled: false,
      startedAtIso: new Date(0).toISOString(),
      cellSummaries: [],
      assetRecords: [],
      transitions: [],
      recentEvents: [],
    };
  },
  dispose() {},
};

let activeDiagnostics: RuntimeDiagnosticsApi = noopDiagnostics;

export function installRuntimeDiagnostics(world: CompiledCellComplex, debugLevel: DebugLevelId, enabled: boolean): void {
  activeDiagnostics.dispose();

  if (!enabled || typeof performance === "undefined") {
    activeDiagnostics = noopDiagnostics;

    if (typeof window !== "undefined") {
      window.__noneuclidDiagnostics = activeDiagnostics.snapshot();
    }

    return;
  }

  const startedAtIso = new Date().toISOString();
  const startedAtMs = performance.now();
  const verbose = isVerboseDebugLevel(debugLevel);
  const recentEvents: string[] = [];
  const assetRecords = new Map<string, AssetDebugRecord>();
  const transitions: PortalTransitionEvent[] = [];
  const cellSummaries = new Map(
    world.cells.map((cell) => [
      cell.id,
      {
        cellId: cell.id,
        assetUses: cell.objects.map((objectSpec) => ({
          objectId: objectSpec.id,
          kind: objectSpec.kind,
          assetPath: objectSpec.assetPath,
        })),
        firstEnteredAtMs: undefined,
      } as CellDebugSummary,
    ]),
  );

  let longTaskObserver: PerformanceObserver | undefined;

  function nowMs(): number {
    return performance.now();
  }

  function relativeMs(): number {
    return Number((nowMs() - startedAtMs).toFixed(1));
  }

  function recordEvent(message: string, detail?: unknown): void {
    const line = `[noneuclid][${relativeMs()}ms] ${message}`;
    recentEvents.push(line);

    if (recentEvents.length > 80) {
      recentEvents.shift();
    }

    if (verbose) {
      if (detail === undefined) {
        console.info(line);
      } else {
        console.info(line, detail);
      }
    }

    publishSnapshot();
  }

  function recordWarn(message: string, detail?: unknown): void {
    const line = `[noneuclid][${relativeMs()}ms] ${message}`;
    recentEvents.push(line);

    if (recentEvents.length > 80) {
      recentEvents.shift();
    }

    if (detail === undefined) {
      console.warn(line);
    } else {
      console.warn(line, detail);
    }

    publishSnapshot();
  }

  function publishSnapshot(): void {
    if (typeof window === "undefined") {
      return;
    }

    window.__noneuclidDiagnostics = {
      enabled: true,
      startedAtIso,
      cellSummaries: [...cellSummaries.values()],
      assetRecords: [...assetRecords.values()],
      transitions: [...transitions],
      recentEvents: [...recentEvents],
    };
  }

  function getAssetKey(assetPath: string, objectId: string, cellId: string, phase: AssetPhase): string {
    return `${phase}:${cellId}:${objectId}:${assetPath}`;
  }

  function upsertAssetRecord(
    assetPath: string,
    objectId: string,
    cellId: string,
    kind: string,
    phase: AssetPhase,
  ): AssetDebugRecord {
    const key = getAssetKey(assetPath, objectId, cellId, phase);
    const existing = assetRecords.get(key);

    if (existing) {
      return existing;
    }

    const created: AssetDebugRecord = {
      assetPath,
      objectId,
      cellId,
      kind,
      phase,
      status: "pending",
    };
    assetRecords.set(key, created);
    return created;
  }

  function summarizeCellAssets(cellId: string): {
    readonly expectedAssetUses: number;
    readonly loadedAssetUses: number;
    readonly pendingAssetUses: number;
    readonly erroredAssetUses: number;
    readonly duplicateInstanceLoadsByAsset: readonly string[];
  } {
    const relevantAssets = [...assetRecords.values()].filter(
      (record) => record.cellId === cellId && record.phase === "instance-load",
    );
    const duplicateCounts = new Map<string, number>();

    for (const record of relevantAssets) {
      duplicateCounts.set(record.assetPath, (duplicateCounts.get(record.assetPath) ?? 0) + 1);
    }

    return {
      expectedAssetUses: cellSummaries.get(cellId)?.assetUses.length ?? 0,
      loadedAssetUses: relevantAssets.filter((record) => record.status === "loaded").length,
      pendingAssetUses: relevantAssets.filter((record) => record.status === "pending").length,
      erroredAssetUses: relevantAssets.filter((record) => record.status === "error").length,
      duplicateInstanceLoadsByAsset: [...duplicateCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([assetPath, count]) => `${assetPath} x${count}`),
    };
  }

  if (typeof PerformanceObserver !== "undefined") {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration >= 50) {
            recordWarn(`browser long task ${entry.duration.toFixed(1)}ms`);
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch {
      longTaskObserver = undefined;
    }
  }

  recordEvent("runtime diagnostics enabled", {
    cells: world.cells.map((cell) => ({
      cellId: cell.id,
      portals: cell.portals.map((portal) => `${portal.id}->${portal.targetCellId}`),
      objectCount: cell.objects.length,
    })),
  });
  recordEvent("diagnostics snapshot available on window.__noneuclidDiagnostics");

  activeDiagnostics = {
    enabled: true,
    recordPreloadStart(assetPath, kind) {
      const record = upsertAssetRecord(assetPath, `preload:${assetPath}`, "__preload__", kind, "preload");
      record.startTimeMs = nowMs();
      record.status = "pending";
      recordEvent(`preload start ${kind} ${assetPath}`);
    },
    recordPreloadComplete(assetPath, kind) {
      const record = upsertAssetRecord(assetPath, `preload:${assetPath}`, "__preload__", kind, "preload");
      record.endTimeMs = nowMs();
      record.status = "loaded";
      const durationMs = (record.endTimeMs - (record.startTimeMs ?? record.endTimeMs)).toFixed(1);
      recordEvent(`preload complete ${kind} ${assetPath} in ${durationMs}ms`);
    },
    recordPreloadError(assetPath, kind, error) {
      const record = upsertAssetRecord(assetPath, `preload:${assetPath}`, "__preload__", kind, "preload");
      record.endTimeMs = nowMs();
      record.status = "error";
      recordWarn(`preload error ${kind} ${assetPath}`, error);
    },
    recordAssetInstanceStart(cellId, objectId, assetPath, kind) {
      const record = upsertAssetRecord(assetPath, objectId, cellId, kind, "instance-load");
      record.startTimeMs = nowMs();
      record.status = "pending";
      recordEvent(`instance load start ${kind} ${cellId}/${objectId} ${assetPath}`);
    },
    recordAssetInstanceComplete(cellId, objectId, assetPath, kind) {
      const record = upsertAssetRecord(assetPath, objectId, cellId, kind, "instance-load");
      record.endTimeMs = nowMs();
      record.status = "loaded";
      const durationMs = (record.endTimeMs - (record.startTimeMs ?? record.endTimeMs)).toFixed(1);
      recordEvent(`instance load complete ${kind} ${cellId}/${objectId} in ${durationMs}ms`, {
        assetPath,
      });
    },
    recordAssetInstanceError(cellId, objectId, assetPath, kind, error) {
      const record = upsertAssetRecord(assetPath, objectId, cellId, kind, "instance-load");
      record.endTimeMs = nowMs();
      record.status = "error";
      recordWarn(`instance load error ${kind} ${cellId}/${objectId}`, { assetPath, error });
    },
    recordCellEntered(fromCellId, toCellId, portalId) {
      const cellSummary = cellSummaries.get(toCellId);
      const firstEntry = cellSummary?.firstEnteredAtMs === undefined;

      if (cellSummary && cellSummary.firstEnteredAtMs === undefined) {
        cellSummary.firstEnteredAtMs = nowMs();
      }

      const transition: PortalTransitionEvent = {
        atMs: nowMs(),
        fromCellId,
        toCellId,
        portalId,
      };
      transitions.push(transition);

      if (transitions.length > 40) {
        transitions.shift();
      }

      recordEvent(
        `${firstEntry ? "first" : "repeat"} portal entry ${fromCellId} -> ${toCellId} via ${portalId}`,
        summarizeCellAssets(toCellId),
      );
    },
    recordWarmup(reason, durationMs) {
      recordEvent(`scene warmup ${reason} in ${durationMs.toFixed(1)}ms`);
    },
    recordFrame(cellId, timings) {
      if (timings.totalMs < 120 && timings.renderMs < 80) {
        return;
      }

      const recentTransition = transitions[transitions.length - 1];
      const transitionAgeMs = recentTransition ? nowMs() - recentTransition.atMs : undefined;
      recordWarn(`slow frame in ${cellId}`, {
        totalMs: Number(timings.totalMs.toFixed(1)),
        moveMs: Number(timings.moveMs.toFixed(1)),
        renderMs: Number(timings.renderMs.toFixed(1)),
        recentTransition:
          transitionAgeMs !== undefined && transitionAgeMs < 1500
            ? {
                fromCellId: recentTransition.fromCellId,
                toCellId: recentTransition.toCellId,
                portalId: recentTransition.portalId,
                ageMs: Number(transitionAgeMs.toFixed(1)),
              }
            : undefined,
        cellAssets: summarizeCellAssets(cellId),
      });
    },
    snapshot() {
      return {
        enabled: true,
        startedAtIso,
        cellSummaries: [...cellSummaries.values()],
        assetRecords: [...assetRecords.values()],
        transitions: [...transitions],
        recentEvents: [...recentEvents],
      };
    },
    dispose() {
      longTaskObserver?.disconnect();
    },
  };

  publishSnapshot();
}

export function runtimeDiagnostics(): RuntimeDiagnosticsApi {
  return activeDiagnostics;
}
