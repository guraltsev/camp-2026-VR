import * as THREE from "three";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import type {
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
  RuntimeToolId,
} from "../../runtime/runtimeMenuState";
import type { PaletteDefinition } from "../../ui/paletteDefinition";
import type { PlacedFlagType } from "../../world-objects/placedFlags";
import { resolvePaletteTooltipLabel } from "../../ui/paletteTooltips";
import { createScenePaletteLibraryAdapter } from "./scenePaletteLibraryAdapter";
import type {
  ScenePaletteInputFrame,
  ScenePalettePlacement,
  ScenePalettePointerSource,
} from "./scenePaletteInput";
import { chooseActiveScenePointer, createScenePointers } from "./scenePointers";

export interface ScenePaletteControllerOptions {
  readonly scene: THREE.Scene;
  readonly getCamera: () => THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly getIsOpen: () => boolean;
  readonly onOpenRequested: () => void;
  readonly onCloseRequested: () => void;
  readonly onShowSettingsRequested: () => void;
  readonly onShowMainRequested: () => void;
  readonly onWorldSelected: (worldId: string) => void;
  readonly onReloadRequested: () => void;
  readonly onHomeRequested: () => void;
  readonly onDebugEnabledChanged: (enabled: boolean) => void;
  readonly onDebugSettingsRequested: () => void;
  readonly onConsoleLogLevelSelected: (level: RuntimeMenuConsoleLogLevelId) => void;
  readonly onDebugOverlayToggled: (enabled: boolean) => void;
  readonly onDebugOverlayItemToggled: (itemId: RuntimeDebugOverlayItemId, enabled: boolean) => void;
  readonly onPortalPanelModeSelected: (mode: PortalPanelModeId) => void;
  readonly onPortalInspectionToggled: (enabled: boolean) => void;
  readonly onCollisionGeometryWireframesToggled: (enabled: boolean) => void;
  readonly onAimCollisionOutlinesToggled: (enabled: boolean) => void;
  readonly onToolSelected: (toolId: RuntimeToolId) => void;
  readonly onPlaceFlagOptionsRequested: () => void;
  readonly onPlaceFlagTypeSelected: (flagType: PlacedFlagType) => void;
  readonly onGeodesicCannonAddRequested: (cannonId: string) => void;
  readonly onGeodesicCannonCarryRequested: (cannonId: string) => void;
  readonly onGeodesicCannonTieAndDetachRequested: (cannonId: string) => void;
  readonly onGeodesicCannonRotateRequested: (cannonId: string, geodesicId?: string) => void;
  readonly onGeodesicCannonAimRequested: (cannonId: string, geodesicId?: string) => void;
  readonly onGeodesicCannonDeleteRequested: (cannonId: string, geodesicId: string) => void;
  readonly onGeometryComputerSetSkewRequested: (computerId: string, skewXMeters: number) => void;
  readonly onGeometryComputerStepSkewRequested: (computerId: string, deltaXMeters: number) => void;
  readonly onSignKeyboardCharacter: (character: string) => void;
  readonly onSignKeyboardBackspace: () => void;
  readonly onSignDeleteRequested: () => void;
}

export interface ScenePaletteControllerUpdate {
  readonly input: ScenePaletteInputFrame;
  readonly definition: PaletteDefinition;
  readonly placement: ScenePalettePlacement;
}

export interface ScenePaletteController {
  update(frame: ScenePaletteControllerUpdate): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

const forwardAxis = new THREE.Vector3(0, 0, -1);
const worldQuaternion = new THREE.Quaternion();
const worldScale = new THREE.Vector3();
const rayOrigin = new THREE.Vector3();
const rayDirection = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointerRay = new THREE.Ray();
const menuSurfaceNormal = new THREE.Vector3();
const palettePlane = new THREE.Plane();
const palettePlanePoint = new THREE.Vector3();
const palettePlaneIntersection = new THREE.Vector3();
const sceneRayObjects = new Map<string, THREE.Line>();

interface PaletteHit {
  readonly point: THREE.Vector3;
  readonly action?: () => void;
  readonly itemId?: string;
  readonly tooltipLabel?: string;
}

export function createScenePaletteController(options: ScenePaletteControllerOptions): ScenePaletteController {
  const paletteRoot = new THREE.Group();
  paletteRoot.name = "scene-palette-root";
  const adapter = createScenePaletteLibraryAdapter({
    onLeftAction(actionId) {
      if (actionId === "settings") {
        options.onShowSettingsRequested();
      }
    },
    onRightAction(actionId) {
      if (actionId === "close") {
        options.onCloseRequested();
      } else if (actionId === "back") {
        options.onShowMainRequested();
      }
    },
    onWorldSelected: options.onWorldSelected,
    onReloadRequested: options.onReloadRequested,
    onHomeRequested: options.onHomeRequested,
    onDebugEnabledChanged: options.onDebugEnabledChanged,
    onDebugSettingsRequested: options.onDebugSettingsRequested,
    onConsoleLogLevelSelected: options.onConsoleLogLevelSelected,
    onDebugOverlayToggled: options.onDebugOverlayToggled,
    onDebugOverlayItemToggled: options.onDebugOverlayItemToggled,
    onPortalPanelModeSelected: options.onPortalPanelModeSelected,
    onPortalInspectionToggled: options.onPortalInspectionToggled,
    onCollisionGeometryWireframesToggled: options.onCollisionGeometryWireframesToggled,
    onAimCollisionOutlinesToggled: options.onAimCollisionOutlinesToggled,
    onToolSelected: options.onToolSelected,
    onPlaceFlagOptionsRequested: options.onPlaceFlagOptionsRequested,
    onPlaceFlagTypeSelected: options.onPlaceFlagTypeSelected,
    onGeodesicCannonAddRequested: options.onGeodesicCannonAddRequested,
    onGeodesicCannonCarryRequested: options.onGeodesicCannonCarryRequested,
    onGeodesicCannonTieAndDetachRequested: options.onGeodesicCannonTieAndDetachRequested,
    onGeodesicCannonRotateRequested: options.onGeodesicCannonRotateRequested,
    onGeodesicCannonAimRequested: options.onGeodesicCannonAimRequested,
    onGeodesicCannonDeleteRequested: options.onGeodesicCannonDeleteRequested,
    onGeometryComputerSetSkewRequested: options.onGeometryComputerSetSkewRequested,
    onGeometryComputerStepSkewRequested: options.onGeometryComputerStepSkewRequested,
    onSignKeyboardCharacter: options.onSignKeyboardCharacter,
    onSignKeyboardBackspace: options.onSignKeyboardBackspace,
    onSignDeleteRequested: options.onSignDeleteRequested,
  });
  adapter.root.rotation.y = Math.PI;
  paletteRoot.add(adapter.root);
  options.scene.add(paletteRoot);
  const paletteHitMarker = createPaletteHitMarker();
  options.scene.add(paletteHitMarker);
  const paletteTooltip = createPaletteTooltip();
  options.scene.add(paletteTooltip.root);
  const scenePointers = createScenePointers(options.getCamera);
  let currentDefinitionSignature = "";
  let previousMenuTogglePressed = false;

  return {
    update(frame) {
      const definitionSignature = JSON.stringify(frame.definition);
      if (definitionSignature !== currentDefinitionSignature) {
        currentDefinitionSignature = definitionSignature;
        adapter.setDefinition(frame.definition);
      }

      if (frame.input.menuTogglePressed && !previousMenuTogglePressed) {
        if (options.getIsOpen()) {
          options.onCloseRequested();
        } else {
          options.onOpenRequested();
        }
      }
      previousMenuTogglePressed = frame.input.menuTogglePressed;

      paletteRoot.position.copy(frame.placement.position);
      paletteRoot.quaternion.copy(frame.placement.quaternion);
      paletteRoot.scale.setScalar(frame.placement.scale ?? 1);
      paletteRoot.updateMatrixWorld(true);
      adapter.setVisible(options.getIsOpen());
      adapter.update(frame.input.deltaSeconds * 1000);
      syncSceneRays(options.scene, frame.input.pointers, options.getIsOpen());

      const pointerStates = scenePointers.update(options.scene, frame.input.pointers);
      const activePointer = chooseActiveScenePointer(pointerStates);
      const pointerSourcesById = new Map(frame.input.pointers.map((source) => [source.id, source] as const));
      const activePointerSource = activePointer ? pointerSourcesById.get(activePointer.id) : undefined;
      const paletteHit = options.getIsOpen() && activePointerSource
        ? resolvePaletteHit(adapter.root, activePointerSource.object)
        : undefined;
      const cursorPoint = paletteHit?.point
        ?? (activePointerSource?.kind === "desktop-aimer"
          ? resolvePalettePlanePoint(adapter.root, activePointerSource.object)
          : undefined);
      updatePaletteHitMarker(paletteHitMarker, adapter.root, cursorPoint);
      updatePaletteTooltip(paletteTooltip, adapter.root, paletteHit?.point, paletteHit?.tooltipLabel);
      if (paletteHit?.action && activePointer?.selectStarted) {
        paletteHit.action();
      }
    },
    setVisible(visible) {
      adapter.setVisible(visible);
      paletteHitMarker.visible = false;
      paletteTooltip.root.visible = false;
      hideSceneRays();
    },
    dispose() {
      scenePointers.dispose();
      adapter.dispose();
      paletteRoot.removeFromParent();
      paletteHitMarker.removeFromParent();
      paletteHitMarker.geometry.dispose();
      paletteHitMarker.material.dispose();
      paletteTooltip.dispose();
      disposeSceneRays();
    },
  };
}

function syncSceneRays(
  scene: THREE.Scene,
  sources: readonly ScenePalettePointerSource[],
  visible: boolean,
): void {
  const seenIds = new Set<string>();

  for (const source of sources) {
    seenIds.add(source.id);
    const ray = getOrCreateSceneRay(scene, source.id);
    ray.visible = visible && source.visibleRay !== false;
    ray.position.copy(source.object.position);
    ray.quaternion.copy(source.object.quaternion);
    ray.updateMatrixWorld(true);
  }

  for (const [id, ray] of sceneRayObjects) {
    if (!seenIds.has(id)) {
      ray.visible = false;
    }
  }
}

function getOrCreateSceneRay(scene: THREE.Scene, id: string): THREE.Line {
  const existing = sceneRayObjects.get(id);
  if (existing) {
    return existing;
  }

  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -2.5),
  ]);
  const rayMaterial = new THREE.LineBasicMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.78,
    depthTest: false,
    depthWrite: false,
  });
  const ray = new THREE.Line(rayGeometry, rayMaterial);
  ray.name = `scene-palette-ray-${id}`;
  ray.renderOrder = 1002;
  ray.visible = false;
  sceneRayObjects.set(id, ray);
  scene.add(ray);
  return ray;
}

function hideSceneRays(): void {
  for (const ray of sceneRayObjects.values()) {
    ray.visible = false;
  }
}

function disposeSceneRays(): void {
  for (const ray of sceneRayObjects.values()) {
    ray.removeFromParent();
    ray.geometry.dispose();
    disposeMaterial(ray.material);
  }
  sceneRayObjects.clear();
}

function disposeMaterial(material: THREE.Material | readonly THREE.Material[]): void {
  if ("dispose" in material) {
    material.dispose();
  } else {
    for (const item of material) {
      item.dispose();
    }
  }
}

function createPaletteHitMarker(): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
  const marker = new THREE.Mesh(
    new THREE.CircleGeometry(0.018, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  marker.name = "scene-palette-hit-marker";
  marker.renderOrder = 1004;
  marker.visible = false;
  return marker;
}

function updatePaletteHitMarker(
  marker: THREE.Mesh,
  paletteSurface: THREE.Object3D,
  point: THREE.Vector3 | undefined,
): void {
  if (!point) {
    marker.visible = false;
    return;
  }

  paletteSurface.getWorldQuaternion(marker.quaternion);
  menuSurfaceNormal.set(0, 0, 1).applyQuaternion(marker.quaternion).normalize();
  marker.position.copy(point).addScaledVector(menuSurfaceNormal, 0.002);
  marker.visible = true;
  marker.updateMatrixWorld(true);
}

function resolvePaletteHit(
  root: THREE.Object3D,
  sourceObject: THREE.Object3D,
): PaletteHit | undefined {
  sourceObject.updateMatrixWorld(true);
  sourceObject.matrixWorld.decompose(rayOrigin, worldQuaternion, worldScale);
  rayDirection.copy(forwardAxis).applyQuaternion(worldQuaternion).normalize();
  raycaster.ray.origin.copy(rayOrigin);
  raycaster.ray.direction.copy(rayDirection);
  raycaster.near = 0.01;
  raycaster.far = 4;

  const intersections = raycaster.intersectObject(root, true);
  const firstIntersection = intersections[0];
  if (!firstIntersection) {
    return undefined;
  }

  let action: (() => void) | undefined;
  let itemId: string | undefined;
  for (const intersection of intersections) {
    action ??= findPaletteAction(intersection.object);
    itemId ??= findPaletteItemId(intersection.object);
    if (action && itemId) {
      break;
    }
  }

  return {
    point: firstIntersection.point.clone(),
    action,
    itemId,
    tooltipLabel: resolvePaletteTooltipLabel(itemId),
  };
}

function resolvePalettePlanePoint(
  paletteSurface: THREE.Object3D,
  sourceObject: THREE.Object3D,
): THREE.Vector3 | undefined {
  sourceObject.updateMatrixWorld(true);
  sourceObject.matrixWorld.decompose(rayOrigin, worldQuaternion, worldScale);
  rayDirection.copy(forwardAxis).applyQuaternion(worldQuaternion).normalize();

  paletteSurface.updateMatrixWorld(true);
  paletteSurface.getWorldPosition(palettePlanePoint);
  paletteSurface.getWorldQuaternion(worldQuaternion);
  menuSurfaceNormal.set(0, 0, 1).applyQuaternion(worldQuaternion).normalize();
  palettePlane.setFromNormalAndCoplanarPoint(menuSurfaceNormal, palettePlanePoint);

  pointerRay.origin.copy(rayOrigin);
  pointerRay.direction.copy(rayDirection);
  return pointerRay.intersectPlane(palettePlane, palettePlaneIntersection) ?? undefined;
}

function findPaletteAction(object: THREE.Object3D | null): (() => void) | undefined {
  let current: THREE.Object3D | null = object;

  while (current) {
    const action = current.userData.scenePaletteAction ?? current.userData.xrPaletteAction;
    if (typeof action === "function") {
      return action as () => void;
    }
    current = current.parent;
  }

  return undefined;
}

function findPaletteItemId(object: THREE.Object3D | null): string | undefined {
  let current: THREE.Object3D | null = object;

  while (current) {
    const itemId = current.userData.scenePaletteItemId ?? current.userData.xrPaletteItemId;
    if (typeof itemId === "string") {
      return itemId;
    }
    current = current.parent;
  }

  return undefined;
}

interface PaletteTooltip {
  readonly root: THREE.Object3D;
  update(label: string): void;
  dispose(): void;
}

function createPaletteTooltip(): PaletteTooltip {
  const root = new THREE.Group();
  root.name = "scene-palette-hover-tooltip";
  root.visible = false;
  let currentLabel = "";

  return {
    root,
    update(label) {
      if (label === currentLabel) {
        return;
      }

      currentLabel = label;
      for (const child of [...root.children]) {
        disposeObject3D(child);
      }
      root.clear();
      root.add(createPaletteTooltipMesh(label));
    },
    dispose() {
      root.removeFromParent();
      disposeObject3D(root);
    },
  };
}

function updatePaletteTooltip(
  tooltip: PaletteTooltip,
  paletteSurface: THREE.Object3D,
  point: THREE.Vector3 | undefined,
  label: string | undefined,
): void {
  if (!point || !label) {
    tooltip.root.visible = false;
    return;
  }

  tooltip.update(label);
  paletteSurface.getWorldQuaternion(tooltip.root.quaternion);
  menuSurfaceNormal.set(0, 0, 1).applyQuaternion(tooltip.root.quaternion).normalize();
  tooltip.root.position.copy(point)
    .addScaledVector(menuSurfaceNormal, 0.006)
    .add(new THREE.Vector3(0.04, 0.04, 0).applyQuaternion(tooltip.root.quaternion));
  tooltip.root.visible = true;
  tooltip.root.updateMatrixWorld(true);
}

function createPaletteTooltipMesh(label: string): THREE.Object3D {
  const lines = wrapPaletteTooltipLabel(label);
  const canvas = document.createElement("canvas");
  canvas.width = 448;
  canvas.height = 96 + Math.max(0, lines.length - 1) * 34;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Object3D();
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 22, 18, 404, canvas.height - 36, 14);
  context.fillStyle = "rgba(15, 23, 42, 0.95)";
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = "rgba(186, 230, 253, 0.9)";
  context.stroke();
  context.fillStyle = "#f8fafc";
  context.font = "bold 24px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const firstLineY = canvas.height / 2 - ((lines.length - 1) * 17);
  for (let index = 0; index < lines.length; index += 1) {
    context.fillText(lines[index] ?? "", canvas.width / 2, firstLineY + index * 34, 364);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const planeWidth = 0.32;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeWidth * (canvas.height / canvas.width)),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  mesh.name = "scene-palette-hover-tooltip:label";
  mesh.renderOrder = 1008;
  return mesh;
}

export function wrapPaletteTooltipLabel(label: string, maxLineLength = 38): readonly string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > maxLineLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}
