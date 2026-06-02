import type { DesktopControls } from "./desktopControls";

export type DesktopPaletteInputEvent =
  | { readonly kind: "canvas-contextmenu" }
  | { readonly kind: "secondary-click" }
  | { readonly kind: "escape-key" }
  | { readonly kind: "outside-secondary-click"; readonly targetInsidePalette: boolean };

export type DesktopPaletteInputAction = "open" | "close" | "none";

export interface DesktopPaletteInputOptions {
  readonly canvas: HTMLCanvasElement;
  readonly paletteRoot: HTMLElement;
  readonly controls: Pick<DesktopControls, "pause" | "resume" | "requestPointerLock" | "isPointerLocked">;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly setResumePromptVisible: (visible: boolean) => void;
}

export interface DesktopPaletteInput {
  readonly isOpen: () => boolean;
  open(): void;
  close(options?: { readonly requestPointerLock?: boolean }): void;
  dispose(): void;
}

export function createDesktopPaletteInput(options: DesktopPaletteInputOptions): DesktopPaletteInput {
  let menuOpen = false;

  function applyAction(
    action: DesktopPaletteInputAction,
    actionOptions: { readonly requestPointerLockOnClose?: boolean } = {},
  ): void {
    if (action === "open" && !menuOpen) {
      menuOpen = true;
      options.controls.pause();
      options.setResumePromptVisible(false);
      options.onOpen();
      return;
    }

    if (action === "close" && menuOpen) {
      const requestPointerLockOnClose = actionOptions.requestPointerLockOnClose ?? true;
      menuOpen = false;
      options.onClose();
      options.controls.resume({ requestPointerLock: requestPointerLockOnClose });
      options.setResumePromptVisible(!requestPointerLockOnClose);
    }
  }

  function onCanvasContextMenu(event: MouseEvent): void {
    event.preventDefault();
    applyAction(reduceDesktopPaletteInput(menuOpen, { kind: "canvas-contextmenu" }));
  }

  function onWindowKeyDown(event: KeyboardEvent): void {
    if (event.code !== "Escape") {
      return;
    }

    const action = reduceDesktopPaletteInput(menuOpen, { kind: "escape-key" });

    if (action !== "none") {
      event.preventDefault();
      applyAction(action, { requestPointerLockOnClose: false });
    }
  }

  function onWindowMouseDown(event: MouseEvent): void {
    if (event.button !== 2) {
      return;
    }

    if (!menuOpen && (event.target === options.canvas || options.controls.isPointerLocked())) {
      event.preventDefault();
      applyAction(reduceDesktopPaletteInput(menuOpen, { kind: "secondary-click" }));
      return;
    }

    const action = reduceDesktopPaletteInput(menuOpen, {
      kind: "outside-secondary-click",
      targetInsidePalette: options.paletteRoot.contains(event.target as Node | null),
    });

    if (action !== "none") {
      event.preventDefault();
      applyAction(action);
    }
  }

  function onPointerLockChange(): void {
    if (options.controls.isPointerLocked()) {
      options.setResumePromptVisible(false);
    }
  }

  options.canvas.addEventListener("contextmenu", onCanvasContextMenu);
  window.addEventListener("keydown", onWindowKeyDown);
  window.addEventListener("mousedown", onWindowMouseDown);
  document.addEventListener("pointerlockchange", onPointerLockChange);

  return {
    isOpen: () => menuOpen,
    open() {
      applyAction("open");
    },
    close(closeOptions = {}) {
      applyAction("close", { requestPointerLockOnClose: closeOptions.requestPointerLock });
    },
    dispose() {
      options.canvas.removeEventListener("contextmenu", onCanvasContextMenu);
      window.removeEventListener("keydown", onWindowKeyDown);
      window.removeEventListener("mousedown", onWindowMouseDown);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    },
  };
}

export function reduceDesktopPaletteInput(
  isOpen: boolean,
  event: DesktopPaletteInputEvent,
): DesktopPaletteInputAction {
  switch (event.kind) {
    case "canvas-contextmenu":
    case "secondary-click":
      return isOpen ? "none" : "open";
    case "escape-key":
      return isOpen ? "close" : "none";
    case "outside-secondary-click":
      return isOpen && !event.targetInsidePalette ? "close" : "none";
  }
}
