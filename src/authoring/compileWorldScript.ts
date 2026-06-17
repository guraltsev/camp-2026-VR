import type { CellComplexSpec } from "../cell-complex/specs";
import { worldObjectLibrary } from "../world-objects/library";
import { worldFloorTextureLibrary } from "../world-assets/floorTextures";
import { createWorldBuilder } from "./worldBuilder";

export interface CompileWorldScriptOptions {
  readonly sourceName?: string;
}

export function compileWorldScript(sourceText: string, options: CompileWorldScriptOptions = {}): CellComplexSpec {
  const builder = createWorldBuilder();
  const globals = {
    PolygonFace: builder.PolygonFace,
    Portal: builder.Portal,
    FlippedPortal: builder.FlippedPortal,
    OnFace: builder.OnFace,
    ...worldFloorTextureLibrary,
    ...worldObjectLibrary,
  } as const;
  const assignedValues = new Map<string, unknown>();
  const scope = new Proxy(Object.create(null) as Record<string, unknown>, {
    has(_target, key) {
      return typeof key === "string";
    },
    get(_target, key) {
      if (key === Symbol.unscopables) {
        return undefined;
      }

      if (typeof key !== "string") {
        return undefined;
      }

      if (key in globals) {
        return globals[key as keyof typeof globals];
      }

      if (assignedValues.has(key)) {
        return assignedValues.get(key);
      }

      throw new ReferenceError(`Unknown authoring name "${key}".`);
    },
    set(_target, key, value) {
      if (typeof key !== "string") {
        return false;
      }

      if (key in globals) {
        throw new Error(`Cannot assign to reserved authoring name "${key}".`);
      }

      assignedValues.set(key, value);
      return true;
    },
    getOwnPropertyDescriptor() {
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value: undefined,
      };
    },
  });

  try {
    const execute = new Function(
      "scope",
      `with (scope) {\n${sourceText}\n}`,
    ) as (scope: object) => void;
    execute(scope);
    return builder.build();
  } catch (error) {
    throw new Error(formatWorldScriptError(error, options.sourceName));
  }
}

function formatWorldScriptError(error: unknown, sourceName?: string): string {
  const prefix = sourceName ? `World script "${sourceName}"` : "World script";

  if (error instanceof Error) {
    return `${prefix} failed: ${error.message}`;
  }

  return `${prefix} failed.`;
}
