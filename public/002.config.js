// Locked-down starter configuration for the 002 Basic Tetrahedron scenario.

export default {
  startingWorld: "002-basic-tetrahedron",

  optionsMenu: {
    worldSelectionSection: false,
    debugSection: false,
  },

  tools: {
    // Sign placement and editing.
    placeFlags: true,

    // All other tools are hidden for this scenario.
    geodesicEmitters: false,
    distances: false,
    angles: false,
  },

  debug: {
    level: "off",
    portalPanels: "none",
    renderQuality: false,

    overlay: {
      enabled: false,
      items: {
        fps: false,
        location: false,
        "portal-quantities": false,
      },
    },

    options: {
      "runtime-diagnostics": false,
      "portal-path-debug": false,
      "portal-static-cull-debug": false,
      "portal-visible-path-debug": false,
      "portal-path-overlays": false,
      "portal-path-overlay-instances": false,
      "forbidden-zone-wireframes": false,
      "object-collision-wireframes": false,
      "selectable-hitboxes": false,
      "aim-collision-outlines": false,
    },
  },
};
