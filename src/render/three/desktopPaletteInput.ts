import type { DesktopControls } from "./desktopControls";

export type DesktopPaletteInputEvent =
  | { readonly kind: "canvas-contextmenu" }
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
  close(): void;
  dispose(): void;
}

export function createDesktopPaletteInput(options: DesktopPaletteInputOptions): DesktopPaletteInput {
  let menuOpen = false;

  function applyAction(action: DesktopPaletteInputAction): void {
    if (action === "open" && !menuOpen) {
      menuOpen = true;
      options.controls.pause();
      options.setResumePromptVisible(false);
      options.onOpen();
      return;
    }

    if (action === "close" && menuOpen) {
      menuOpen = false;
      options.controls.resume({ requestPointerLock: false });
      options.setResumePromptVisible(!options.controls.isPointerLocked());
      options.onClose();
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
      applyAction(action);
    }
  }

  function onWindowMouseDown(event: MouseEvent): void {
    if (event.button !== 2) {
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
    close() {
      applyAction("close");
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
      return isOpen ? "none" : "open";
    case "escape-key":
      return isOpen ? "close" : "none";
    case "outside-secondary-click":
      return isOpen && !event.targetInsidePalette ? "close" : "none";
  }
}
