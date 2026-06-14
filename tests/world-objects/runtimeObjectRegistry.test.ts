import { describe, expect, it } from "vitest";
import { identityRigidTransform3 } from "../../src/math/rigidTransform3";
import { simpleCollisionCylinder } from "../../src/movement/dynamicObject";
import { createRuntimeObjectRegistry, type RuntimeCreatureObject } from "../../src/world-objects/runtimeObjectRegistry";

function creature(id: string, cellId: string, extra: Partial<RuntimeCreatureObject> = {}): RuntimeCreatureObject {
  return {
    id,
    kind: "geo-mouse",
    cellId,
    localPose: identityRigidTransform3,
    portalRenderable: true,
    ...extra,
  };
}

describe("runtimeObjectRegistry", () => {
  it("adds objects by id and indexes them under their cell", () => {
    const registry = createRuntimeObjectRegistry();
    const object = creature("mouse-a", "cell-a");

    registry.add(object);

    expect(registry.get("mouse-a")).toBe(object);
    expect(registry.getObjectsInCell("cell-a")).toEqual([object]);
  });

  it("moving an object updates old and new cell indexes", () => {
    const registry = createRuntimeObjectRegistry([creature("mouse-a", "cell-a")]);

    const moved = registry.moveToCell("mouse-a", "cell-b");

    expect(moved?.cellId).toBe("cell-b");
    expect(registry.getObjectsInCell("cell-a")).toEqual([]);
    expect(registry.getObjectsInCell("cell-b").map((object) => object.id)).toEqual(["mouse-a"]);
  });

  it("removing an object clears id and cell indexes", () => {
    const registry = createRuntimeObjectRegistry([creature("mouse-a", "cell-a")]);

    registry.remove("mouse-a");

    expect(registry.get("mouse-a")).toBeUndefined();
    expect(registry.getObjectsInCell("cell-a")).toEqual([]);
  });

  it("filters collidable and interactable objects", () => {
    const collidable = creature("mouse-a", "cell-a", { collision: simpleCollisionCylinder(0.5, 1) });
    const interactable = creature("mouse-b", "cell-a", {
      interactable: { label: "Edit", action: "edit-flag" },
    });
    const registry = createRuntimeObjectRegistry([collidable, interactable, creature("mouse-c", "cell-a")]);

    expect(registry.getCollidableObjectsInCell("cell-a").map((object) => object.id)).toEqual(["mouse-a"]);
    expect(registry.getInteractableObjectsInCell("cell-a").map((object) => object.id)).toEqual(["mouse-b"]);
  });

  it("finds tooltip-capable objects from either tooltip metadata or interaction data", () => {
    const labelled = creature("mouse-a", "cell-a", {
      tooltip: { label: "geodesic mouse" },
    });
    const interactable = creature("mouse-b", "cell-a", {
      interactable: { label: "Edit", action: "edit-flag" },
    });
    const registry = createRuntimeObjectRegistry([labelled, interactable, creature("mouse-c", "cell-a")]);

    expect(registry.getTooltipObjectsInCell("cell-a").map((object) => object.id)).toEqual(["mouse-a", "mouse-b"]);
  });
});
