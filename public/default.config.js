// Noneuclid FPV app configuration.
// This file is plain JavaScript so it can be edited by hand and can contain comments.
// Restart or refresh the app after changing it.

export default {
  // Available worlds: "cube", "dodecahedron", "icosahedron", "octahedron", "tetrahedron", "torus".
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
    level: "off",

    // "none", "panel", "panel-with-text", or "text-only".
    portalPanels: "none",

    // Higher quality portal rendering. Costs more GPU time.
    renderQuality: false,

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
