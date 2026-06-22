export interface RestartableXrSession {
  end(): Promise<void>;
  addEventListener(type: "end", listener: () => void, options?: AddEventListenerOptions): void;
}

export interface XrSessionRestartCoordinator {
  requestRestart(
    session: RestartableXrSession | null | undefined,
    restart: () => void,
    onEndFailed?: (error: unknown) => void,
  ): void;
  cancel(): void;
}

export function createXrSessionRestartCoordinator(): XrSessionRestartCoordinator {
  let pendingRestart: (() => void) | undefined;
  let endingSession = false;

  function completeRestart(): void {
    const restart = pendingRestart;
    pendingRestart = undefined;
    endingSession = false;
    restart?.();
  }

  return {
    requestRestart(session, restart, onEndFailed) {
      if (!session) {
        restart();
        return;
      }

      pendingRestart = restart;

      if (endingSession) {
        return;
      }

      endingSession = true;
      session.addEventListener("end", completeRestart, { once: true });
      void session.end().catch((error) => {
        pendingRestart = undefined;
        endingSession = false;
        onEndFailed?.(error);
      });
    },
    cancel() {
      pendingRestart = undefined;
      endingSession = false;
    },
  };
}
