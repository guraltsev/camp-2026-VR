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
  position: [0, 0, 0],
  scale: 0.9,
});

torus_mouse = geo_mouse("torus-geo-mouse", {
  position: [-4.4, 0, 1.1],
  turn: 70,
  speed: 2.7,
  oscillationRate: 1.7,
  oscillationMagnitude: 0.18,
});

OnFace("torus-room", [torus_house, torus_mouse]);
