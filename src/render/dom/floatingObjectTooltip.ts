export interface FloatingObjectTooltip {
  readonly root: HTMLDivElement;
  update(options: {
    readonly visible: boolean;
    readonly text?: string;
    readonly xPixels?: number;
    readonly yPixels?: number;
  }): void;
  dispose(): void;
}

export function createFloatingObjectTooltip(container: HTMLElement): FloatingObjectTooltip {
  const root = document.createElement("div");
  root.className = "floating-object-tooltip";
  root.hidden = true;
  container.append(root);

  return {
    root,
    update(options) {
      root.hidden = !options.visible || !options.text;
      if (root.hidden) {
        return;
      }

      root.textContent = options.text ?? "";
      const width = root.offsetWidth;
      const height = root.offsetHeight;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const marginPixels = 12;
      const xPixels = clamp(
        options.xPixels ?? viewportWidth / 2,
        marginPixels + width / 2,
        Math.max(marginPixels + width / 2, viewportWidth - marginPixels - width / 2),
      );
      const yPixels = clamp(
        options.yPixels ?? viewportHeight / 2,
        marginPixels + height,
        Math.max(marginPixels + height, viewportHeight - marginPixels),
      );

      root.style.transform = `translate(-50%, -100%) translate(${Math.round(xPixels)}px, ${Math.round(yPixels)}px)`;
    },
    dispose() {
      root.remove();
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
