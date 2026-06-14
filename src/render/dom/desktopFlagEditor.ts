import { placedFlagFontColors, placedFlagMaxMessageLength, type PlacedFlagObject } from "../../world-objects/placedFlags";

export interface DesktopFlagEditor {
  readonly root: HTMLDivElement;
  open(flag: PlacedFlagObject): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

export function createDesktopFlagEditor(
  container: HTMLElement,
  options: {
    readonly onMessageChanged: (flagId: string, message: string) => void;
    readonly onFontColorChanged: (flagId: string, fontColor: string) => void;
    readonly onDeleteRequested: (flagId: string) => void;
    readonly onClosed: () => void;
  },
): DesktopFlagEditor {
  const root = document.createElement("div");
  root.className = "desktop-flag-editor";
  root.hidden = true;

  const form = document.createElement("form");
  form.className = "desktop-flag-editor-panel";

  const frameCloseButton = document.createElement("button");
  frameCloseButton.type = "button";
  frameCloseButton.className = "desktop-flag-editor-close";
  frameCloseButton.textContent = "X";
  frameCloseButton.ariaLabel = "Close flag editor";

  const header = document.createElement("div");
  header.className = "desktop-flag-editor-header";

  const input = document.createElement("input");
  input.className = "desktop-flag-editor-input";
  input.type = "text";
  input.maxLength = placedFlagMaxMessageLength;
  input.ariaLabel = "Flag message";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "desktop-flag-editor-delete";
  deleteButton.textContent = "\u{1f5d1}";
  deleteButton.ariaLabel = "Delete flag";

  const colors = document.createElement("div");
  colors.className = "desktop-flag-editor-colors";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "desktop-tool-palette-button";
  closeButton.textContent = "Done";

  let activeFlagId: string | undefined;

  input.addEventListener("input", () => {
    if (activeFlagId) {
      options.onMessageChanged(activeFlagId, input.value);
    }
  });
  closeButton.addEventListener("click", () => {
    editor.close();
  });
  frameCloseButton.addEventListener("click", () => {
    editor.close();
  });
  deleteButton.addEventListener("click", () => {
    if (!activeFlagId) {
      return;
    }

    const flagId = activeFlagId;
    options.onDeleteRequested(flagId);
    editor.close();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    editor.close();
  });

  const handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.code !== "Escape" || root.hidden) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    editor.close();
  };

  header.append(input, deleteButton);
  form.append(frameCloseButton, header, colors, closeButton);
  root.append(form);
  container.append(root);

  const editor: DesktopFlagEditor = {
    root,
    open(flag) {
      activeFlagId = flag.id;
      input.value = flag.message;
      colors.replaceChildren(...placedFlagFontColors.map((color) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "desktop-flag-editor-color";
        button.style.backgroundColor = color;
        button.ariaLabel = `Set flag text color ${color}`;
        button.dataset.selected = String(color === flag.fontColor);
        button.addEventListener("click", () => {
          if (activeFlagId) {
            options.onFontColorChanged(activeFlagId, color);
            for (const item of colors.querySelectorAll("button")) {
              item.dataset.selected = String(item === button);
            }
          }
        });
        return button;
      }));
      root.hidden = false;
      document.addEventListener("keydown", handleDocumentKeyDown, true);
      input.focus();
      input.select();
    },
    close() {
      if (root.hidden) {
        return;
      }

      root.hidden = true;
      activeFlagId = undefined;
      document.removeEventListener("keydown", handleDocumentKeyDown, true);
      options.onClosed();
    },
    isOpen() {
      return !root.hidden;
    },
    dispose() {
      document.removeEventListener("keydown", handleDocumentKeyDown, true);
      root.remove();
    },
  };

  return editor;
}
