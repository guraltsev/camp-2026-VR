import * as THREE from "three";

export type WorldResultBadgeVariant = "length" | "angle" | "success" | "warning";

export interface WorldResultBadgeOptions {
  readonly text: string;
  readonly variant: WorldResultBadgeVariant;
  readonly widthMeters: number;
  readonly heightMeters: number;
  readonly pointer?: "down" | "none";
  readonly doubleFaced?: boolean;
  readonly renderOrder?: number;
}

const variantColors: Readonly<Record<WorldResultBadgeVariant, {
  readonly fill: string;
  readonly stroke: string;
  readonly fallback: number;
}>> = {
  length: {
    fill: "rgba(20, 83, 45, 0.94)",
    stroke: "rgba(134, 239, 172, 0.96)",
    fallback: 0x14532d,
  },
  angle: {
    fill: "rgba(15, 118, 110, 0.94)",
    stroke: "rgba(255, 209, 102, 0.96)",
    fallback: 0x0f766e,
  },
  success: {
    fill: "rgba(22, 101, 52, 0.94)",
    stroke: "rgba(187, 247, 208, 0.96)",
    fallback: 0x166534,
  },
  warning: {
    fill: "rgba(146, 64, 14, 0.94)",
    stroke: "rgba(253, 186, 116, 0.96)",
    fallback: 0x92400e,
  },
};

export function createWorldResultBadge(options: WorldResultBadgeOptions): THREE.Object3D {
  const material = createWorldResultBadgeMaterial(options);
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(options.widthMeters, options.heightMeters);
  const front = new THREE.Mesh(geometry, material);
  front.name = "world-result-badge:front";
  front.position.z = 0.001;
  front.renderOrder = options.renderOrder ?? 0;
  group.add(front);

  if (options.doubleFaced ?? false) {
    const back = new THREE.Mesh(geometry.clone(), cloneBadgeMaterial(material));
    back.name = "world-result-badge:back";
    back.position.z = -0.001;
    back.rotation.y = Math.PI;
    back.renderOrder = options.renderOrder ?? 0;
    group.add(back);
  }

  group.renderOrder = options.renderOrder ?? 0;
  return group;
}

function createWorldResultBadgeMaterial(options: WorldResultBadgeOptions): THREE.MeshBasicMaterial {
  const colors = variantColors[options.variant];
  if (typeof document === "undefined") {
    return new THREE.MeshBasicMaterial({
      color: colors.fallback,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      side: THREE.FrontSide,
    });
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.MeshBasicMaterial({
      color: colors.fallback,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      side: THREE.FrontSide,
    });
  }

  drawBadgeCanvas(context, canvas, options, colors);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

function drawBadgeCanvas(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  options: WorldResultBadgeOptions,
  colors: typeof variantColors[WorldResultBadgeVariant],
): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 36, 28, 440, 82, 18);
  context.fillStyle = colors.fill;
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = colors.stroke;
  context.stroke();

  if ((options.pointer ?? "down") === "down") {
    context.beginPath();
    context.moveTo(238, 110);
    context.lineTo(256, 134);
    context.lineTo(274, 110);
    context.closePath();
    context.fillStyle = colors.fill;
    context.fill();
    context.strokeStyle = colors.stroke;
    context.stroke();
  }

  context.font = "bold 40px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 5;
  context.strokeStyle = "rgba(2, 6, 23, 0.78)";
  context.fillStyle = "#ffffff";
  context.strokeText(options.text, canvas.width / 2, 70, 410);
  context.fillText(options.text, canvas.width / 2, 70, 410);
}

function cloneBadgeMaterial(material: THREE.MeshBasicMaterial): THREE.MeshBasicMaterial {
  const clone = material.clone();
  if (material.map) {
    clone.map = material.map.clone();
    clone.map.needsUpdate = true;
  }
  return clone;
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

