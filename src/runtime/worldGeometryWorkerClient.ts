import {
  buildWorldGeometrySnapshotForRequest,
  type BuildWorldGeometrySnapshotRequest,
  type BuildWorldGeometrySnapshotResponse,
} from "./worldGeometryWorker";

export interface WorldGeometryBuildClient {
  readonly worker: boolean;
  buildSnapshot(request: BuildWorldGeometrySnapshotRequest): Promise<BuildWorldGeometrySnapshotResponse>;
  dispose(): void;
}

export function createDefaultWorldGeometryBuildClient(): WorldGeometryBuildClient {
  if (typeof Worker === "undefined") {
    return createInlineWorldGeometryBuildClient();
  }

  try {
    return createWorkerWorldGeometryBuildClient();
  } catch {
    return createInlineWorldGeometryBuildClient();
  }
}

export function createInlineWorldGeometryBuildClient(): WorldGeometryBuildClient {
  let disposed = false;

  return {
    worker: false,
    buildSnapshot(request) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(
            disposed
              ? {
                  kind: "failed",
                  requestId: request.requestId,
                  message: "World geometry build client was disposed.",
                }
              : buildWorldGeometrySnapshotForRequest(request),
          );
        }, 0);
      });
    },
    dispose() {
      disposed = true;
    },
  };
}

export function createWorkerWorldGeometryBuildClient(): WorldGeometryBuildClient {
  const worker = new Worker(new URL("./worldGeometryWorker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, (response: BuildWorldGeometrySnapshotResponse) => void>();
  let disposed = false;

  worker.addEventListener("message", (event: MessageEvent<BuildWorldGeometrySnapshotResponse>) => {
    const resolve = pending.get(event.data.requestId);
    if (!resolve) {
      return;
    }

    pending.delete(event.data.requestId);
    resolve(event.data);
  });

  worker.addEventListener("error", (event) => {
    for (const [requestId, resolve] of pending) {
      resolve({
        kind: "failed",
        requestId,
        message: event.message || "World geometry worker failed.",
      });
    }
    pending.clear();
  });

  return {
    worker: true,
    buildSnapshot(request) {
      if (disposed) {
        return Promise.resolve({
          kind: "failed",
          requestId: request.requestId,
          message: "World geometry build client was disposed.",
        });
      }

      return new Promise((resolve) => {
        pending.set(request.requestId, resolve);
        worker.postMessage(request);
      });
    },
    dispose() {
      disposed = true;
      for (const [requestId, resolve] of pending) {
        resolve({
          kind: "failed",
          requestId,
          message: "World geometry build client was disposed.",
        });
      }
      pending.clear();
      worker.terminate();
    },
  };
}
