import { describe, expect, it } from "vitest";
import { resolvePaletteTooltipLabel } from "../../src/ui/paletteTooltips";

describe("paletteTooltips", () => {
  it("names global and object palette controls concisely", () => {
    expect(resolvePaletteTooltipLabel("go-home")).toBe("Home");
    expect(resolvePaletteTooltipLabel("reload-world")).toBe("Reload");
    expect(resolvePaletteTooltipLabel("geodesic-cannon-action:add-geodesic")).toBe("Add geodesic");
    expect(resolvePaletteTooltipLabel("geodesic-cannon-action:delete:g-a")).toBe("Delete geodesic");
    expect(resolvePaletteTooltipLabel("sign-action:trash")).toBe("Delete sign");
  });

  it("names tool tiles and sign controls", () => {
    expect(resolvePaletteTooltipLabel("tool:measure-length")).toBe("Measure length");
    expect(resolvePaletteTooltipLabel("tool:protractor")).toBe("Measure angle");
    expect(resolvePaletteTooltipLabel("tool:geodesic-cannon")).toBe("Create and terminate straight lines");
    expect(resolvePaletteTooltipLabel("tool-options:place-sign")).toBe("Sign options");
    expect(resolvePaletteTooltipLabel("sign-type:WoodenSign1")).toBe("Choose sign type");
  });
});
