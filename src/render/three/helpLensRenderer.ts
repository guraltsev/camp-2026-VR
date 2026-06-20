import * as THREE from "three";
import type { HelpLensDefinition, HelpLensRow } from "../../ui/helpLensDefinition";

export interface HelpLensRenderer {
  update(options: {
    readonly visible: boolean;
    readonly xrActive: boolean;
    readonly definition?: HelpLensDefinition;
    readonly camera: THREE.Camera;
  }): void;
  dispose(): void;
}

export function createHelpLensRenderer(container: HTMLElement, scene: THREE.Scene): HelpLensRenderer {
  const domRoot = document.createElement("div");
  domRoot.className = "help-lens";
  domRoot.hidden = true;
  container.append(domRoot);
  let xrPanel: { readonly signature: string; readonly root: THREE.Object3D } | undefined;

  return {
    update(options) {
      const visible = options.visible && options.definition !== undefined;
      if (!visible) {
        domRoot.hidden = true;
        if (xrPanel) {
          xrPanel.root.visible = false;
        }
        return;
      }

      if (options.xrActive) {
        domRoot.hidden = true;
        const panel = syncXrPanel(scene, xrPanel, options.definition);
        xrPanel = panel;
        panel.root.visible = true;
        positionXrPanel(panel.root, options.camera);
        return;
      }

      if (xrPanel) {
        xrPanel.root.visible = false;
      }
      syncDomPanel(domRoot, options.definition);
    },
    dispose() {
      domRoot.remove();
      if (xrPanel) {
        xrPanel.root.removeFromParent();
        disposeObject3D(xrPanel.root);
        xrPanel = undefined;
      }
    },
  };
}

function syncDomPanel(root: HTMLDivElement, definition: HelpLensDefinition): void {
  root.hidden = false;
  root.replaceChildren();
  const title = document.createElement("div");
  title.className = "help-lens-title";
  title.textContent = definition.title;
  const body = document.createElement("div");
  body.className = "help-lens-body";
  appendTextWithMouseIcons(body, definition.body);
  const rows = document.createElement("div");
  rows.className = "help-lens-rows";
  for (const rowDefinition of definition.rows) {
    const row = document.createElement("div");
    row.className = "help-lens-row";
    row.append(createHintNode(rowDefinition), document.createTextNode(rowDefinition.label));
    rows.append(row);
  }
  root.append(title, body, rows);
}

function createHintNode(row: HelpLensRow): HTMLElement {
  const hint = document.createElement("span");
  hint.className = "input-hint";
  hint.setAttribute("aria-label", row.hint.label);
  if (row.hint.iconSrc) {
    const icon = document.createElement("img");
    icon.className = "input-hint-icon";
    icon.src = row.hint.iconSrc;
    icon.alt = row.hint.label;
    if (row.hint.mode === "desktop" && (row.hint.intent === "primary" || row.hint.intent === "context-menu")) {
      icon.classList.add("input-hint-icon-inverted");
    }
    hint.append(icon);
    return hint;
  }

  hint.classList.add("input-hint-text");
  hint.textContent = row.hint.label;
  return hint;
}

function appendTextWithMouseIcons(parent: HTMLElement, text: string): void {
  const pattern = /(Left click|Right click|\b[FBHY]\b)/g;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) {
      continue;
    }
    if (match.index > index) {
      parent.append(document.createTextNode(text.slice(index, match.index)));
    }
    parent.append(createInlineHintIcon(match[0]));
    index = match.index + match[0].length;
  }
  if (index < text.length) {
    parent.append(document.createTextNode(text.slice(index)));
  }
}

function createInlineHintIcon(label: string): HTMLImageElement {
  const icon = document.createElement("img");
  icon.className = "input-hint-icon input-hint-icon-inline input-hint-icon-inverted";
  icon.src = inlineIconSrcByLabel(label);
  icon.alt = label;
  return icon;
}

function inlineIconSrcByLabel(label: string): string {
  switch (label) {
    case "Left click":
      return "/assets/icons/left-click-icon.png";
    case "Right click":
      return "/assets/icons/right-click-icon.png";
    case "F":
      return "/assets/icons/f-alphabet-round-icon.png";
    case "B":
      return "/assets/icons/b-alphabet-round-icon.png";
    case "H":
      return "/assets/icons/h-alphabet-round-icon.png";
    case "Y":
      return "/assets/icons/y-alphabet-round-icon.png";
  }

  return "";
}

function syncXrPanel(
  scene: THREE.Scene,
  current: { readonly signature: string; readonly root: THREE.Object3D } | undefined,
  definition: HelpLensDefinition,
): { readonly signature: string; readonly root: THREE.Object3D } {
  const signature = JSON.stringify(definition);
  if (current?.signature === signature) {
    return current;
  }

  if (current) {
    current.root.removeFromParent();
    disposeObject3D(current.root);
  }

  const root = createXrHelpPanel(definition);
  scene.add(root);
  return { signature, root };
}

function createXrHelpPanel(definition: HelpLensDefinition): THREE.Object3D {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Object3D();
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 28, 28, 712, 320, 28);
  context.fillStyle = "rgba(15, 23, 42, 0.94)";
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = "rgba(125, 211, 252, 0.92)";
  context.stroke();

  context.fillStyle = "#f8fafc";
  context.font = "bold 42px sans-serif";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(definition.title, 64, 58, 640);

  context.font = "28px sans-serif";
  wrapText(context, definition.body, 64, 124, 640, 34, 2);

  context.font = "bold 26px sans-serif";
  let rowY = 220;
  for (const row of definition.rows.slice(0, 3)) {
    context.fillText(`${row.hint.label}: ${row.label}`, 84, rowY, 600);
    rowY += 38;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.48), material);
  mesh.name = "help-lens:xr-panel";
  mesh.renderOrder = 1010;
  return mesh;
}

function positionXrPanel(root: THREE.Object3D, camera: THREE.Camera): void {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  root.position.copy(camera.position)
    .addScaledVector(forward, 1.2)
    .addScaledVector(right, 0.32)
    .addScaledVector(up, -0.08);
  root.quaternion.copy(camera.quaternion);
  root.updateMatrixWorld(true);
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount += 1;
      if (lineCount >= maxLines) {
        return;
      }
    } else {
      line = testLine;
    }
  }
  if (line && lineCount < maxLines) {
    context.fillText(line, x, y + lineCount * lineHeight);
  }
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

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      entry.dispose();
    }
    return;
  }
  if ("map" in material && material.map instanceof THREE.Texture) {
    material.map.dispose();
  }
  material.dispose();
}
