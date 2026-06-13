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
      root.style.transform = `translate(-50%, -100%) translate(${Math.round(options.xPixels ?? 0)}px, ${Math.round(options.yPixels ?? 0)}px)`;
    },
    dispose() {
      root.remove();
    },
  };
}
