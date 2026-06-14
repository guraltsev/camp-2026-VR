import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDesktopPaletteInput,
  reduceDesktopPaletteInput,
} from "../../src/render/three/desktopPaletteInput";

afterEach(() => {
  vi.unstubAllGlobals();
});

function installDomEventTargets(): { readonly documentTarget: EventTarget } {
  const documentTarget = new EventTarget();

  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", documentTarget);

  return { documentTarget };
}

describe("desktopPaletteInput", () => {
  it("opens on canvas right-click when closed", () => {
    expect(reduceDesktopPaletteInput(false, { kind: "canvas-contextmenu" })).toBe("open");
  });

  it("opens on secondary click when closed", () => {
    expect(reduceDesktopPaletteInput(false, { kind: "secondary-click" })).toBe("open");
  });

  it("closes on escape when open", () => {
    expect(reduceDesktopPaletteInput(true, { kind: "escape-key" })).toBe("close");
  });

  it("closes on outside right-click when open", () => {
    expect(
      reduceDesktopPaletteInput(true, {
        kind: "outside-secondary-click",
        targetInsidePalette: false,
      }),
    ).toBe("close");
  });

  it("ignores inside right-clicks while open", () => {
    expect(
      reduceDesktopPaletteInput(true, {
        kind: "outside-secondary-click",
        targetInsidePalette: true,
      }),
    ).toBe("none");
  });

  it("shows the resume prompt whenever look is not captured and the menu is closed", () => {
    const { documentTarget } = installDomEventTargets();
    const canvas = new EventTarget() as HTMLCanvasElement;
    const paletteRoot = { contains: () => false } as unknown as HTMLElement;
    let pointerLocked = true;
    const resumePromptVisibility: boolean[] = [];

    const input = createDesktopPaletteInput({
      canvas,
      paletteRoot,
      controls: {
        pause: vi.fn(() => {
          pointerLocked = false;
        }),
        resume: vi.fn(async () => pointerLocked),
        isPointerLocked: () => pointerLocked,
      },
      onOpen: vi.fn(),
      onClose: vi.fn(),
      setResumePromptVisible: (visible) => {
        resumePromptVisibility.push(visible);
      },
    });

    expect(resumePromptVisibility.at(-1)).toBe(false);

    pointerLocked = false;
    documentTarget.dispatchEvent(new Event("pointerlockchange"));
    expect(resumePromptVisibility.at(-1)).toBe(true);

    pointerLocked = true;
    documentTarget.dispatchEvent(new Event("pointerlockchange"));
    expect(resumePromptVisibility.at(-1)).toBe(false);

    input.dispose();
  });

  it("keeps the resume prompt hidden while the menu is open", () => {
    installDomEventTargets();
    const canvas = new EventTarget() as HTMLCanvasElement;
    const paletteRoot = { contains: () => false } as unknown as HTMLElement;
    let pointerLocked = true;
    const resumePromptVisibility: boolean[] = [];

    const input = createDesktopPaletteInput({
      canvas,
      paletteRoot,
      controls: {
        pause: vi.fn(() => {
          pointerLocked = false;
        }),
        resume: vi.fn(async () => pointerLocked),
        isPointerLocked: () => pointerLocked,
      },
      onOpen: vi.fn(),
      onClose: vi.fn(),
      setResumePromptVisible: (visible) => {
        resumePromptVisibility.push(visible);
      },
    });

    input.open();

    expect(input.isOpen()).toBe(true);
    expect(pointerLocked).toBe(false);
    expect(resumePromptVisibility.at(-1)).toBe(false);

    input.dispose();
  });
});
