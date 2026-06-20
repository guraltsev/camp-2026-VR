import type { RuntimeToolId } from "../runtime/runtimeMenuState";
import type { RuntimeWorldObject } from "../world-objects/runtimeObjectRegistry";
import type { InputIntent, InputMode } from "./inputIntents";
import { getInputHintGlyph } from "./inputIntents";

export type WorldInteractionActionId =
  | "open-object-menu"
  | "edit-sign"
  | "open-geometry-computer"
  | "extend-geodesic"
  | "measure-length"
  | "select-protractor-side"
  | "select-protractor-vertex"
  | "remove-measurement"
  | "remove-angle"
  | "add-geodesic"
  | "carry-emitter"
  | "rotate-geodesic"
  | "aim-geodesic"
  | "tie-detach-geodesics"
  | "delete-geodesic";

export interface WorldInteractionAction {
  readonly id: WorldInteractionActionId;
  readonly label: string;
  readonly intent: InputIntent;
  readonly available: boolean;
  readonly unavailableReason?: string;
  readonly priority?: number;
}

export interface WorldFocusMessageDefinition {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions: readonly WorldInteractionAction[];
  readonly helpTopicId?: string;
}

export interface CreateWorldFocusMessageDefinitionOptions {
  readonly object: RuntimeWorldObject;
  readonly selectedTool: RuntimeToolId;
  readonly canExtendGeodesic?: boolean;
}

export function createWorldFocusMessageDefinition(
  options: CreateWorldFocusMessageDefinitionOptions,
): WorldFocusMessageDefinition | undefined {
  const title = options.object.tooltip?.label ?? options.object.interactable?.label;
  if (!title) {
    return undefined;
  }

  switch (options.object.kind) {
    case "placed-flag":
      return {
        title,
        actions: [contextAction("edit-sign", "Edit")],
        helpTopicId: "sign",
      };
    case "asset":
      if (options.object.interactable?.action === "open-geometry-computer") {
        return {
          title,
          actions: [contextAction("open-geometry-computer", "Torus skew")],
          helpTopicId: "geometry-computer",
        };
      }
      return { title, actions: [] };
    case "geodesic-cannon":
      return {
        title,
        actions: [contextAction("open-object-menu", "Emitter menu")],
        helpTopicId: "geodesic-emitter",
      };
    case "geodesic-segment":
      return {
        title,
        actions: getGeodesicSegmentActions(options),
        helpTopicId: "geodesic-segment",
      };
    case "geodesic-intersection":
      return {
        title,
        actions: options.selectedTool === "protractor"
          ? [primaryAction("select-protractor-vertex", "Select for protractor")]
          : [],
        helpTopicId: "geodesic-vertex",
      };
    case "measured-geodesic-length":
      return {
        title,
        actions: [primaryAction("remove-measurement", "Remove")],
        helpTopicId: "measured-length",
      };
    case "protractor-angle":
      return {
        title,
        actions: [primaryAction("remove-angle", "Remove")],
        helpTopicId: "protractor-angle",
      };
    case "geodesci-marmot":
    case "geo-mouse":
    case "geo-butterfly":
      return {
        title,
        actions: [],
        helpTopicId: "creature",
      };
  }
}

export function formatWorldFocusMessageTextForLegacyFallback(
  definition: WorldFocusMessageDefinition | undefined,
  mode: InputMode,
): string | undefined {
  if (!definition) {
    return undefined;
  }

  const rows = [definition.title];
  if (definition.subtitle) {
    rows.push(definition.subtitle);
  }

  const availableActions = [...definition.actions]
    .filter((action) => action.available)
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0));
  for (const action of availableActions) {
    const hints = getActionHintLabels(mode, action);
    rows.push(hints.length > 0 ? `${hints.join(" / ")} - ${action.label}` : action.label);
  }

  return rows.join("\n");
}

function getGeodesicSegmentActions(
  options: CreateWorldFocusMessageDefinitionOptions,
): readonly WorldInteractionAction[] {
  if (options.selectedTool === "measure-length") {
    return [primaryAction("measure-length", "Measure length")];
  }

  if (options.selectedTool === "protractor") {
    return [primaryAction("select-protractor-side", "Select side")];
  }

  if (options.canExtendGeodesic) {
    return [primaryAction("extend-geodesic", "Extend")];
  }

  return [{
    id: "extend-geodesic",
    label: "Locked",
    intent: "primary",
    available: false,
  }];
}

function contextAction(id: WorldInteractionActionId, label: string): WorldInteractionAction {
  return {
    id,
    label,
    intent: "context-menu",
    available: true,
  };
}

function primaryAction(id: WorldInteractionActionId, label: string): WorldInteractionAction {
  return {
    id,
    label,
    intent: "primary",
    available: true,
  };
}

function getActionHintLabels(mode: InputMode, action: WorldInteractionAction): readonly string[] {
  const hints = [getInputHintGlyph(mode, action.intent).label];
  if (mode === "desktop" && action.intent === "context-menu") {
    hints.push(getInputHintGlyph(mode, "keyboard-context-fallback").label);
  }
  return hints;
}

