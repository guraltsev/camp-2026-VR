square = [
  [-7.5, -7.5],
  [7.5, -7.5],
  [7.5, 7.5],
  [-7.5, 7.5],
];

PolygonFace("torus-room", floorTexture("river_pebbles"), square);

Portal("torus-room", 0, "torus-room", 2);
Portal("torus-room", 1, "torus-room", 3);

torus_house = small_house("torus-center-house", {
  position: [2.8, 0, 0],
  scale: 0.9,
});

torus_mouse = geo_mouse("torus-geo-mouse", {
  position: [-4.4, 0, 1.1],
  turn: 70,
  speed: 2.7,
  oscillationRate: 1.7,
  oscillationMagnitude: 0.18,
});

torus_bench = bench("torus-bench", {
  position: [3.1, 0, -2.4],
  scale: 0.9,
  turn: -35,
});

torus_traffic_cone = traffic_cone("torus-traffic-cone", {
  position: [-2.7, 0, -2.8],
  scale: 0.85,
  turn: 12,
});

torus_flower_group = flower_group("torus-flower-group", {
  position: [2.6, 0, 2.6],
  scale: 0.9,
  turn: 28,
});

OnFace("torus-room", [torus_house, torus_mouse, torus_bench, torus_traffic_cone, torus_flower_group]);
