export interface LoadingStatus {
  setPhase(phase: string): void;
  track<T>(phase: string, task: () => T | Promise<T>): Promise<T>;
  showError(message: string): void;
  dispose(): void;
}

export interface LoadingStatusOptions {
  readonly initialMessage?: string;
}

const defaultInitialMessage = "Starting world";

export function createLoadingStatus(
  container: HTMLElement,
  options: LoadingStatusOptions = {},
): LoadingStatus {
  const root = document.createElement("div");
  root.className = "loading-screen";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");

  const log = document.createElement("div");
  log.className = "loading-screen-log";
  root.append(log);
  container.append(root);

  let activeLine: HTMLDivElement | undefined;

  function appendLine(message: string): HTMLDivElement {
    activeLine?.classList.remove("loading-screen-line-active");

    const line = document.createElement("div");
    line.className = "loading-screen-line loading-screen-line-active";
    line.textContent = message;
    log.append(line);
    log.scrollTop = log.scrollHeight;
    return line;
  }

  const setMessage = (message: string) => {
    if (activeLine?.textContent === message) {
      return;
    }

    activeLine = appendLine(message);
  };

  activeLine = appendLine(options.initialMessage ?? defaultInitialMessage);

  return {
    setPhase(nextPhase) {
      setMessage(nextPhase);
    },
    async track(nextPhase, task) {
      setMessage(nextPhase);
      await waitForPaint();
      return await task();
    },
    showError(message) {
      root.classList.add("loading-screen-error");
      setMessage(`Could not load world: ${message}`);
    },
    dispose() {
      root.remove();
    },
  };
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
