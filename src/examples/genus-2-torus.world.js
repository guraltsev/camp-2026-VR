octagon = [
  [8.31491579260158, -3.444150891285808],
  [8.31491579260158, 3.444150891285808],
  [3.444150891285808, 8.31491579260158],
  [-3.444150891285808, 8.31491579260158],
  [-8.31491579260158, 3.444150891285808],
  [-8.31491579260158, -3.444150891285808],
  [-3.444150891285808, -8.31491579260158],
  [3.444150891285808, -8.31491579260158],
];

PolygonFace("genus-2-octagon", floorTexture("paving_stones"), octagon);

Portal("genus-2-octagon", 0, "genus-2-octagon", 2);
Portal("genus-2-octagon", 1, "genus-2-octagon", 3);
Portal("genus-2-octagon", 4, "genus-2-octagon", 6);
Portal("genus-2-octagon", 5, "genus-2-octagon", 7);

startingHouse("genus-2-octagon", {
  position: [-3.0, 0, 0.6],
  scale: 1,
  turn: 12,
});

startingQuestionCube("genus-2-octagon", {
  position: [-2.45, 0.05, 3.25],
  scale: 1,
  turn: -18,
  goalPages: [{
    title: "Goal",
    body: "Explore the regular octagon model of a genus-2 torus. Each paired portal wraps one side of the two-handled surface.",
  }],
});

genus_2_mouse = geo_mouse("genus-2-geo-mouse", {
  position: [-4.8, 0, -1.4],
  turn: 58,
  speed: 2.4,
  oscillationRate: 1.5,
  oscillationMagnitude: 0.18,
});

genus_2_bench = bench("genus-2-bench", {
  position: [3.6, 0, -2.7],
  scale: 0.85,
  turn: -28,
});

genus_2_marker = traffic_cone("genus-2-traffic-cone", {
  position: [4.2, 0, 2.6],
  scale: 0.85,
  turn: 34,
});

genus_2_flower_group = flower_group("genus-2-flower-group", {
  position: [-1.0, 0, -4.0],
  scale: 0.9,
  turn: 18,
});

genus_2_computer = computer_large("genus-2-geometry-computer", {
  position: [-4.8, 0, 3.2],
  scale: 1.05,
  turn: 52,
});

OnFace("genus-2-octagon", [
  genus_2_mouse,
  genus_2_bench,
  genus_2_marker,
  genus_2_flower_group,
  genus_2_computer,
]);
