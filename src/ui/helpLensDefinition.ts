import type { RuntimeToolId } from "../runtime/runtimeMenuState";
import type { InputMode } from "./inputIntents";
import { getInputHintGlyph, type InputHintGlyph } from "./inputIntents";
import type { WorldFocusMessageDefinition } from "./worldInteractionDefinition";

export interface HelpLensRow {
  readonly hint: InputHintGlyph;
  readonly label: string;
}

export interface HelpLensDefinition {
  readonly title: string;
  readonly body: string;
  readonly rows: readonly HelpLensRow[];
}

export interface CreateHelpLensDefinitionOptions {
  readonly focus?: WorldFocusMessageDefinition;
  readonly selectedTool: RuntimeToolId;
  readonly inputMode: InputMode;
}

export function createHelpLensDefinition(options: CreateHelpLensDefinitionOptions): HelpLensDefinition {
  if (options.focus) {
    return createFocusedHelpLens(options.focus, options.inputMode);
  }

  return createToolHelpLens(options.selectedTool, options.inputMode);
}

function createFocusedHelpLens(focus: WorldFocusMessageDefinition, inputMode: InputMode): HelpLensDefinition {
  const topic = focus.helpTopicId ?? "default";
  const body = focus.displayHelpMessage ?? helpBodyByTopic[topic] ?? "A world object you can inspect from here.";
  const actionRows = focus.actions
    .filter((action) => action.available)
    .map((action) => ({
      hint: getInputHintGlyph(inputMode, action.intent),
      label: action.label,
    }));

  return {
    title: focus.title,
    body,
    rows: actionRows,
  };
}

function createToolHelpLens(selectedTool: RuntimeToolId, inputMode: InputMode): HelpLensDefinition {
  const primaryHint = getInputHintGlyph(inputMode, "primary");
  const contextHint = getInputHintGlyph(inputMode, "context-menu");
  switch (selectedTool) {
    case "place-flag":
      return {
        title: "Sign tool",
        body: "Places a note on the floor where you aim.",
        rows: [row(primaryHint, "place sign"), row(contextHint, "open tools")],
      };
    case "geodesic-cannon":
      return {
        title: "Ray tool",
        body: "Places geodesic emitters and starts locally straight rays.",
        rows: [row(primaryHint, "place or continue ray"), row(contextHint, "open choices")],
      };
    case "measure-length":
      return {
        title: "Length tool",
        body: "Measures total length along a selected geodesic.",
        rows: [row(primaryHint, "choose geodesic"), row(contextHint, "open choices")],
      };
    case "protractor":
      return {
        title: "Protractor tool",
        body: "Measures the angle between two geodesic sides at a vertex.",
        rows: [row(primaryHint, "select vertex or side"), row(contextHint, "open choices")],
      };
    case "geodesic-cannon-carry":
      return {
        title: "Carry emitter",
        body: "Moves the selected geodesic emitter while preserving its editable rays.",
        rows: [row(primaryHint, "place emitter")],
      };
    case "geodesic-cannon-rotate":
      return {
        title: "Rotate ray",
        body: "Turns the selected geodesic around its emitter.",
        rows: [row(primaryHint, "finish rotation")],
      };
    case "geodesic-cannon-aim":
      return {
        title: "Aim ray",
        body: "Points the selected geodesic toward the aimed location.",
        rows: [row(primaryHint, "accept aim")],
      };
    case "geodesic-cannon-tie-detach":
      return {
        title: "Tie and detach",
        body: "Selects two locked incident geodesics and rebuilds them as a detached path.",
        rows: [row(primaryHint, "select geodesic")],
      };
    case "aim":
    case "none":
      return {
        title: "Explore",
        body: "Look at objects to see available actions, or open the tools menu.",
        rows: [row(primaryHint, "use selected action"), row(contextHint, "open tools or object menu")],
      };
  }
}

function row(hint: InputHintGlyph, label: string): HelpLensRow {
  return { hint, label };
}

const helpBodyByTopic: Readonly<Record<string, string>> = {
  sign: "A placed note in the world. Open its menu to edit text or delete it.",
  "geometry-computer": "Changes the torus skew for worlds that support live geometry deformation.",
  "geodesic-emitter": "Creates and edits geodesic rays from this point.",
  "geodesic-segment": "A locally straight ray segment. Some segments continue through portals.",
  "geodesic-vertex": "A meeting point where geodesic sides can be selected for angle measurement.",
  "measured-length": "A persistent length result attached to a geodesic.",
  "protractor-angle": "A persistent angle result between two selected geodesic sides.",
  creature: "A moving object following the geometry of the world.",
};
