import type { RuntimeToolId } from "../runtime/runtimeMenuState";
import type { InputMode } from "./inputIntents";
import { getInputHintGlyph } from "./inputIntents";
import type { WorldFocusMessageDefinition } from "./worldInteractionDefinition";

export interface HelpLensDefinition {
  readonly title: string;
  readonly body: string;
  readonly rows: readonly string[];
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
  const body = helpBodyByTopic[topic] ?? "A world object you can inspect from here.";
  const actionRows = focus.actions
    .filter((action) => action.available)
    .map((action) => `${getInputHintGlyph(inputMode, action.intent).label}: ${action.label}`);

  return {
    title: focus.title,
    body,
    rows: actionRows.length > 0 ? actionRows : ["No direct action available."],
  };
}

function createToolHelpLens(selectedTool: RuntimeToolId, inputMode: InputMode): HelpLensDefinition {
  const primary = getInputHintGlyph(inputMode, "primary").label;
  const context = getInputHintGlyph(inputMode, "context-menu").label;
  switch (selectedTool) {
    case "place-flag":
      return {
        title: "Sign tool",
        body: "Places a note on the floor where you aim.",
        rows: [`${primary}: place sign`, `${context}: open tools`],
      };
    case "geodesic-cannon":
      return {
        title: "Ray tool",
        body: "Places geodesic emitters and starts locally straight rays.",
        rows: [`${primary}: place or continue ray`, `${context}: open choices`],
      };
    case "measure-length":
      return {
        title: "Length tool",
        body: "Measures total length along a selected geodesic.",
        rows: [`${primary}: choose geodesic`, `${context}: open choices`],
      };
    case "protractor":
      return {
        title: "Protractor tool",
        body: "Measures the angle between two geodesic sides at a vertex.",
        rows: [`${primary}: select vertex or side`, `${context}: open choices`],
      };
    case "geodesic-cannon-carry":
      return {
        title: "Carry emitter",
        body: "Moves the selected geodesic emitter while preserving its editable rays.",
        rows: [`${primary}: place emitter`],
      };
    case "geodesic-cannon-rotate":
      return {
        title: "Rotate ray",
        body: "Turns the selected geodesic around its emitter.",
        rows: [`${primary}: finish rotation`],
      };
    case "geodesic-cannon-aim":
      return {
        title: "Aim ray",
        body: "Points the selected geodesic toward the aimed location.",
        rows: [`${primary}: accept aim`],
      };
    case "geodesic-cannon-tie-detach":
      return {
        title: "Tie and detach",
        body: "Selects two locked incident geodesics and rebuilds them as a detached path.",
        rows: [`${primary}: select geodesic`],
      };
    case "aim":
    case "none":
      return {
        title: "Explore",
        body: "Look at objects to see available actions, or open the tools menu.",
        rows: [`${primary}: use selected action`, `${context}: open tools or object menu`],
      };
  }
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

