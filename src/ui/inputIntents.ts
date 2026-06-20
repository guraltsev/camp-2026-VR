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
    iconSrc: "/assets/icons/arrowkeys.png",
  },
  primary: {
    label: "Left click",
    iconSrc: "/assets/icons/left-click-icon.png",
  },
  "context-menu": {
    label: "Right click",
    iconSrc: "/assets/icons/right-click-icon.png",
  },
  "keyboard-context-fallback": {
    label: "F",
    iconSrc: "/assets/icons/f-alphabet-round-icon.png",
  },
  help: {
    label: "H",
    iconSrc: "/assets/icons/h-alphabet-round-icon.png",
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
    iconSrc: "/assets/icons/b-alphabet-round-icon.png",
  },
  "next-focus-target": {
    label: "Y",
    iconSrc: "/assets/icons/y-alphabet-round-icon.png",
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
