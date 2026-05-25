import { describe, expect, it } from "vitest";
import { readGeometrySelectionOptions } from "../src/geometrySelection";

describe("geometrySelection", () => {
  it("reads debug as an integer URL option", () => {
    const location = new URL("https://example.test/?geometry=cube&debug=75") as unknown as Location;

    expect(readGeometrySelectionOptions(location)).toMatchObject({
      selectedGeometryId: "cube",
      debugLevel: 75,
    });
  });
});
