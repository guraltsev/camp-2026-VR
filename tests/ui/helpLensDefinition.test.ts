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
    expect(help.rows).toEqual([{
      hint: {
        intent: "context-menu",
        mode: "desktop",
        label: "Right click",
        iconSrc: "/assets/icons/right-click-icon.png",
      },
      label: "Edit",
    }]);
  });

  it("creates selected-tool help when no object is focused", () => {
    const help = createHelpLensDefinition({
      inputMode: "xr",
      selectedTool: "measure-length",
    });

    expect(help.title).toBe("Length tool");
    expect(help.rows).toMatchObject([
      { hint: { label: "Trigger" }, label: "choose geodesic" },
      { hint: { label: "Side trigger" }, label: "open choices" },
    ]);
  });

  it("uses an object's explicit display help message", () => {
    const help = createHelpLensDefinition({
      inputMode: "desktop",
      selectedTool: "none",
      focus: {
        title: "Question cube",
        displayHelpMessage: "Move with WASD and look at objects for prompts.",
        actions: [],
      },
    });

    expect(help.body).toBe("Move with WASD and look at objects for prompts.");
    expect(help.rows).toEqual([]);
  });
});
