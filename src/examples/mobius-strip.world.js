rectangle = [
  [-8, -4],
  [8, -4],
  [8, 4],
  [-8, 4],
];

PolygonFace("mobius-room", floorTexture("gravelly_sand"), rectangle);

FlippedPortal("mobius-room", 1, "mobius-room", 3);

mobius_house = small_house("mobius-house", {
  position: [-3.2, 0, -1.1],
  scale: 0.75,
  turn: -18,
});

mobius_bench = bench("mobius-bench", {
  position: [2.7, 0, 1.9],
  scale: 0.75,
  turn: 35,
});

mobius_cone = traffic_cone("mobius-traffic-cone", {
  position: [4.2, 0, -2.2],
  scale: 0.65,
  turn: 12,
});

mobius_flower_pot = flower_pot("mobius-flower-pot", {
  position: [-5.1, 0, 2.2],
  scale: 0.75,
  turn: 60,
});

mobius_mouse = geo_mouse("mobius-geodesic-mouse", {
  position: [-1.2, 0, 2.8],
  turn: 78,
  speed: 1.1,
  oscillationRate: 1.3,
  oscillationMagnitude: 0.16,
});

mobius_butterfly = geo_butterfly("mobius-geodesic-butterfly", {
  position: [1.7, 1.25, -2.7],
  scale: 0.85,
  turn: -42,
  speed: 0.72,
  oscillationRate: 1.15,
  oscillationMagnitude: 0.22,
});

OnFace("mobius-room", [
  mobius_house,
  mobius_bench,
  mobius_cone,
  mobius_flower_pot,
  mobius_mouse,
  mobius_butterfly,
]);
