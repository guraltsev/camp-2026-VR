import { describe, expect, it } from "vitest";
import { createHelpLensDefinition } from "../../src/ui/helpLensDefinition";

describe("helpLensDefinition", () => {
  it("creates concise object-aware help from focus metadata", () => {
    const help = createHelpLensDefinition({
      inputMode: "desktop",
      selectedTool: "none",
      focus: {
        title: "Sign",
        helpTopicId: "sign",
        actions: [{ id: "edit-sign", label: "Edit", intent: "context-menu", available: true }],
      },
    });

    expect(help.title).toBe("Sign");
    expect(help.body).toContain("placed note");
    expect(help.rows).toEqual(["Right click: Edit"]);
  });

  it("creates selected-tool help when no object is focused", () => {
    const help = createHelpLensDefinition({
      inputMode: "xr",
      selectedTool: "measure-length",
    });

    expect(help.title).toBe("Length tool");
    expect(help.rows).toContain("Trigger: choose geodesic");
    expect(help.rows).toContain("Side trigger: open choices");
  });
});

