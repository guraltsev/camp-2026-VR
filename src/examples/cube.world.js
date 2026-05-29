square = [
  [-7.5, -7.5],
  [7.5, -7.5],
  [7.5, 7.5],
  [-7.5, 7.5],
];

PolygonFace("front", "#d95f5f", square);
PolygonFace("right", "#4f9d69", square);
PolygonFace("back", "#5f79d9", square);
PolygonFace("left", "#d9b44f", square);
PolygonFace("top", "#8f6ed5", square);
PolygonFace("bottom", "#4fb8c7", square);

Portal("front", 0, "bottom", 2);
Portal("front", 1, "right", 3);
Portal("front", 2, "top", 0);
Portal("front", 3, "left", 1);
Portal("right", 0, "bottom", 1);
Portal("right", 1, "back", 3);
Portal("right", 2, "top", 1);
Portal("back", 0, "bottom", 0);
Portal("back", 1, "left", 3);
Portal("back", 2, "top", 2);
Portal("left", 0, "bottom", 3);
Portal("left", 2, "top", 3);

front_house = house("front-house", {
  position: [-1.2, 0, 0.6],
  scale: 1,
  yaw: 0.2,
});

front_marmot = geodesic_marmot("front-runner", {
  position: [-4.2, 0, -1.8],
  scale: 1.05,
  velocity: [2.3, 0.65],
});

right_clock = clock("right-clock", {
  position: [0.8, 0, -0.5],
  scale: 2,
  yaw: -0.35,
});

back_campfire = campfire("back-campfire", {
  position: [0.4, 0, 0.9],
  scale: 2,
  yaw: 1.15,
});

left_tree = tree("left-tree", {
  position: [-0.9, 0, 0.7],
  scale: 0.1,
  yaw: 0.8,
});

top_button = emergency_button("top-button", {
  position: [0.2, 0, -0.2],
  scale: 2,
  yaw: -0.15,
});

bottom_rocks = rocks("bottom-rocks", {
  position: [-0.5, 0, -0.8],
  scale: 2,
  yaw: 0.5,
});

OnFace("front", [front_house, front_marmot]);
OnFace("right", [right_clock]);
OnFace("back", [back_campfire]);
OnFace("left", [left_tree]);
OnFace("top", [top_button]);
OnFace("bottom", [bottom_rocks]);
