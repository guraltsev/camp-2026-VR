import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compileCellComplex } from "../../src/cell-complex/compileCellComplex";
import { twoPrismLoop } from "../../src/authoring/exampleWorlds";
import { buildCellMesh } from "../../src/render/three/buildCellMesh";
import { CEILING_TEXTURE_URL } from "../../src/render/three/ceilingTexture";
import { PORTAL_WALL_TEXTURE_URL } from "../../src/render/three/portalWallTexture";
import type { PreparedWorldAssets } from "../../src/render/three/preloadWorldAssets";

describe("buildCellMesh", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds floor, ceiling, walls, and textured portal wall metadata", () => {
    const compiled = compileCellComplex(twoPrismLoop);
    const cell = compiled.cellsById.get("room-a");

    expect(cell).toBeDefined();
    const roomA = cell!;

    expect(roomA.portalBySideIndex.get(1)?.id).toBe("side-1");

    const preparedAssets: PreparedWorldAssets = {
      getTexture: () => new THREE.Texture(),
      instantiateGltf: () => ({
        scene: new THREE.Group(),
        animations: [],
      }),
    };
    const mesh = buildCellMesh(roomA, {
      debugLevel: "basic",
      portalPanelMode: "panel",
      eyeHeightMeters: 1.6,
      assets: preparedAssets,
    });

    expect(mesh.userData.kind).toBe("cell");
    expect(mesh.userData.portalSides).toEqual([
      {
        portalId: "side-1",
        sideIndex: 1,
        targetCellId: "room-b",
        targetPortalId: "side-3",
      },
    ]);

    const floor = mesh.getObjectByName("floor:room-a");
    const ceiling = mesh.getObjectByName("ceiling:room-a");
    const walls = mesh.getObjectByName("walls:room-a") as THREE.Group | null;
    const portal = mesh.getObjectByName("portal:side-1");
    const portalMesh = portal?.getObjectByName("portal-wall:side-1") as THREE.Mesh | undefined;
    const ceilingMesh = ceiling as THREE.Mesh | undefined;

    expect(floor).toBeDefined();
    expect(ceiling).toBeDefined();
    expect(walls).toBeDefined();
    expect(walls?.children).toHaveLength(roomA.sideCount);
    expect((ceilingMesh?.material as THREE.MeshStandardMaterial | undefined)?.userData.textureUrl).toBe(
      CEILING_TEXTURE_URL,
    );
    expect(portal).toBeDefined();
    expect(portal?.userData.textureUrl).toBe(PORTAL_WALL_TEXTURE_URL);
    expect(portalMesh?.userData.kind).toBe("portal-wall-mesh");
    expect((portalMesh?.geometry as THREE.PlaneGeometry | undefined)?.parameters.height).toBe(roomA.heightMeters);
    expect(portalMesh?.position.y).toBeCloseTo(roomA.heightMeters / 2);
    expect((portalMesh?.material as THREE.MeshStandardMaterial | undefined)?.userData.textureUrl).toBe(
      PORTAL_WALL_TEXTURE_URL,
    );
  });

  it("renders the textured portal wall for panel modes and the placard only for labeled mode", () => {
    const compiled = compileCellComplex(twoPrismLoop);
    const roomA = compiled.cellsById.get("room-a")!;
    const preparedAssets: PreparedWorldAssets = {
      getTexture: () => new THREE.Texture(),
      instantiateGltf: () => ({
        scene: new THREE.Group(),
        animations: [],
      }),
    };

    const noPanelMesh = buildCellMesh(roomA, {
      debugLevel: "basic",
      portalPanelMode: "none",
      eyeHeightMeters: 1.6,
      assets: preparedAssets,
    });
    const panelOnlyMesh = buildCellMesh(roomA, {
      debugLevel: "basic",
      portalPanelMode: "panel",
      eyeHeightMeters: 1.6,
      assets: preparedAssets,
    });

    vi.stubGlobal("document", {
      createElement(tagName: string) {
        if (tagName !== "canvas") {
          throw new Error(`Unexpected element request: ${tagName}`);
        }

        return {
          width: 0,
          height: 0,
          getContext(kind: string) {
            if (kind !== "2d") {
              return null;
            }

            return {
              clearRect() {},
              fillText() {},
              fillStyle: "#ffffff",
              font: "bold 96px system-ui, sans-serif",
              textAlign: "center",
              textBaseline: "middle",
            };
          },
        };
      },
    });

    const labeledMesh = buildCellMesh(roomA, {
      debugLevel: "basic",
      portalPanelMode: "panel-with-text",
      eyeHeightMeters: 1.6,
      assets: preparedAssets,
    });

    expect(noPanelMesh.getObjectByName("portal-wall:side-1")).toBeUndefined();
    expect(noPanelMesh.getObjectByName("portal-debug:room-a")).toBeUndefined();

    expect(panelOnlyMesh.getObjectByName("portal-wall:side-1")).toBeDefined();
    expect(panelOnlyMesh.getObjectByName("portal-debug:room-a")).toBeUndefined();
    expect(panelOnlyMesh.getObjectByName("portal-debug-label:room-a:side-1")).toBeUndefined();

    expect(labeledMesh.getObjectByName("portal-wall:side-1")).toBeDefined();
    expect(labeledMesh.getObjectByName("portal-debug-panel:room-a:side-1")).toBeDefined();
    expect(labeledMesh.getObjectByName("portal-debug-label:room-a:side-1")).toBeDefined();
  });
});
