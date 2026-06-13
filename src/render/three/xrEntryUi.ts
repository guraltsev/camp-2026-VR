import type { XrSessionState } from "./xrSessionState";

export const XR_UNAVAILABLE_MESSAGE_DURATION_MS = 10_000;

export interface XrEntryUi {
  readonly root: HTMLElement;
  update(state: XrSessionState): void;
  dispose(): void;
}

export function createXrEntryUi(container: HTMLElement, onEnterVr: () => void): XrEntryUi {
  const root = document.createElement("div");
  root.className = "xr-entry-ui";
  root.style.position = "absolute";
  root.style.left = "12px";
  root.style.bottom = "12px";
  root.style.zIndex = "10";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.gap = "8px";
  root.style.padding = "8px 10px";
  root.style.borderRadius = "8px";
  root.style.background = "rgba(8, 10, 14, 0.72)";
  root.style.color = "#f7fafc";
  root.style.font = "13px/1.35 system-ui, sans-serif";
  root.style.pointerEvents = "auto";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Enter VR";
  button.style.font = "inherit";
  button.style.padding = "6px 10px";
  button.style.borderRadius = "6px";
  button.style.border = "1px solid rgba(255,255,255,0.35)";
  button.style.background = "#f7fafc";
  button.style.color = "#101318";
  button.style.cursor = "pointer";

  const message = document.createElement("span");
  message.textContent = "Checking VR support";
  root.append(button, message);
  container.append(root);

  button.addEventListener("click", onEnterVr);

  let unavailableMessageTimer: number | undefined;
  let unavailableMessageTimerStatus: XrSessionState["status"] | undefined;
  let dismissedUnavailableMessageStatus: XrSessionState["status"] | undefined;

  function clearUnavailableMessageTimer(): void {
    if (unavailableMessageTimer !== undefined) {
      window.clearTimeout(unavailableMessageTimer);
      unavailableMessageTimer = undefined;
      unavailableMessageTimerStatus = undefined;
    }
  }

  function setRootVisible(visible: boolean): void {
    root.hidden = !visible;
    root.style.display = visible ? "flex" : "none";
  }

  function scheduleUnavailableMessageDismissal(state: XrSessionState): void {
    if (!isTemporaryUnavailableState(state) || dismissedUnavailableMessageStatus === state.status) {
      clearUnavailableMessageTimer();
      return;
    }

    if (unavailableMessageTimerStatus === state.status) {
      return;
    }

    clearUnavailableMessageTimer();
    unavailableMessageTimerStatus = state.status;
    unavailableMessageTimer = window.setTimeout(() => {
      dismissedUnavailableMessageStatus = state.status;
      unavailableMessageTimer = undefined;
      unavailableMessageTimerStatus = undefined;
      setRootVisible(false);
    }, XR_UNAVAILABLE_MESSAGE_DURATION_MS);
  }

  return {
    root,
    update(state) {
      if (!isTemporaryUnavailableState(state)) {
        dismissedUnavailableMessageStatus = undefined;
      }

      const temporaryUnavailableMessageDismissed = dismissedUnavailableMessageStatus === state.status && isTemporaryUnavailableState(state);
      setRootVisible(state.status !== "active" && !temporaryUnavailableMessageDismissed);
      const canEnter = state.immersiveVrSupported && (state.status === "available" || state.status === "ended" || state.status === "failed");
      button.hidden = !canEnter;
      button.disabled = !canEnter;
      message.textContent = messageForState(state);
      scheduleUnavailableMessageDismissal(state);
    },
    dispose() {
      clearUnavailableMessageTimer();
      button.removeEventListener("click", onEnterVr);
      root.remove();
    },
  };
}

function isTemporaryUnavailableState(state: XrSessionState): boolean {
  return state.status === "unsupported" || state.status === "insecure-context";
}

function messageForState(state: XrSessionState): string {
  switch (state.status) {
    case "available":
      return "Immersive VR is available.";
    case "insecure-context":
      return "VR needs HTTPS or localhost.";
    case "unsupported":
      return "Immersive VR is not available in this browser or device.";
    case "entering":
      return "Starting VR...";
    case "failed":
      return state.failureMessage ? `VR failed: ${state.failureMessage}` : "VR could not start.";
    case "ended":
      return "VR ended. Desktop controls are ready.";
    case "active":
      return "VR active.";
    case "unknown":
      return "Checking VR support...";
  }
}
