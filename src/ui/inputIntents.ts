import { publicAssetUrl } from "../glue/assetUrls";

export type InputMode = "desktop" | "xr";

export type InputIntent =
  | "move"
  | "primary"
  | "context-menu"
  | "keyboard-context-fallback"
  | "help"
  | "next-focus-target"
  | "cancel"
  | "reset";

export interface InputHintGlyph {
  readonly intent: InputIntent;
  readonly mode: InputMode;
  readonly label: string;
  readonly iconSrc?: string;
}

const desktopHints: Readonly<Record<InputIntent, Omit<InputHintGlyph, "intent" | "mode">>> = {
  move: {
    label: "Arrow keys",
    iconSrc: publicAssetUrl("icons/arrowkeys.png"),
  },
  primary: {
    label: "Left click",
    iconSrc: publicAssetUrl("icons/left-click-icon.png"),
  },
  "context-menu": {
    label: "Right click",
    iconSrc: publicAssetUrl("icons/right-click-icon.png"),
  },
  "keyboard-context-fallback": {
    label: "F",
    iconSrc: publicAssetUrl("icons/f-alphabet-round-icon.png"),
  },
  help: {
    label: "H",
    iconSrc: publicAssetUrl("icons/h-alphabet-round-icon.png"),
  },
  "next-focus-target": {
    label: "Tab",
  },
  cancel: {
    label: "Esc",
  },
  reset: {
    label: "R",
  },
};

const xrHints: Readonly<Record<InputIntent, Omit<InputHintGlyph, "intent" | "mode">>> = {
  move: {
    label: "Left stick",
  },
  primary: {
    label: "Trigger",
  },
  "context-menu": {
    label: "Side trigger",
  },
  "keyboard-context-fallback": {
    label: "Context fallback",
  },
  help: {
    label: "B",
    iconSrc: publicAssetUrl("icons/b-alphabet-round-icon.png"),
  },
  "next-focus-target": {
    label: "Y",
    iconSrc: publicAssetUrl("icons/y-alphabet-round-icon.png"),
  },
  cancel: {
    label: "Side trigger",
  },
  reset: {
    label: "Stick press",
  },
};

export function getInputHintGlyph(mode: InputMode, intent: InputIntent): InputHintGlyph {
  const hint = mode === "desktop" ? desktopHints[intent] : xrHints[intent];
  return {
    intent,
    mode,
    ...hint,
  };
}
