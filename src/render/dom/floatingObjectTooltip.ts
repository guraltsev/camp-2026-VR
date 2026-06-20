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

      renderTooltipText(root, options.text ?? "");
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

function renderTooltipText(root: HTMLDivElement, text: string): void {
  root.replaceChildren();
  const lines = text.split("\n");
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      root.append(document.createElement("br"));
    }
    appendLineWithMouseIcons(root, line);
  });
}

function appendLineWithMouseIcons(root: HTMLDivElement, line: string): void {
  const pattern = /(Left click|Right click|\b[FBHY]\b)/g;
  let index = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index === undefined) {
      continue;
    }
    if (match.index > index) {
      root.append(document.createTextNode(line.slice(index, match.index)));
    }
    root.append(createHintIcon(match[0]));
    index = match.index + match[0].length;
  }
  if (index < line.length) {
    root.append(document.createTextNode(line.slice(index)));
  }
}

function createHintIcon(label: string): HTMLImageElement {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
