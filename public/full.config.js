// Noneuclid FPV app configuration with every menu, tool, and debug option enabled.
// This file is plain JavaScript so it can be edited by hand and can contain comments.
// Restart or refresh the app after changing it.

export default {
  // Available worlds: "001-basic-cube", "002-basic-tetrahedron", "cube", "dodecahedron", "icosahedron", "octahedron", "tetrahedron", "torus".
  startingWorld: "cube",

  optionsMenu: {
    // Show the world selection section in the in-app options menu.
    worldSelectionSection: true,

    // Show the debug section in the in-app options menu.
    debugSection: true,
  },

  tools: {
    // Sign placement and editing.
    placeFlags: true,

    // Geodesic emitters, emitter menus, and emitter edit actions.
    geodesicEmitters: true,

    // Distance/length measurement tool.
    distances: true,

    // Angle/protractor measurement tool.
    angles: true,
  },

  debug: {
    // "off", "basic", or "verbose".
    level: "verbose",

    // "none", "panel", "panel-with-text", or "text-only".
    portalPanels: "panel-with-text",

    // Higher quality portal rendering. Costs more GPU time.
    renderQuality: true,

    overlay: {
      enabled: true,
      items: {
        fps: true,
        location: true,
        "portal-quantities": true,
      },
    },

    // Every debug option currently supported by the app.
    options: {
      "runtime-diagnostics": true,
      "portal-path-debug": true,
      "portal-static-cull-debug": true,
      "portal-visible-path-debug": true,
      "portal-path-overlays": true,
      "portal-path-overlay-instances": true,
      "forbidden-zone-wireframes": true,
      "object-collision-wireframes": true,
      "selectable-hitboxes": true,
      "aim-collision-outlines": true,
    },
  },
};
