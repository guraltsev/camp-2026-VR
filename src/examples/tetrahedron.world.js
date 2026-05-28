triangle = [
  [0, -13.333333333333334],
  [11.5, 6.666666666666667],
  [-11.5, 6.666666666666667],
];

PolygonFace("face-a", "#d95f5f", triangle);
PolygonFace("face-b", "#4f9d69", triangle);
PolygonFace("face-c", "#5f79d9", triangle);
PolygonFace("face-d", "#d9b44f", triangle);

Portal("face-a", 0, "face-d", 1);
Portal("face-a", 1, "face-b", 1);
Portal("face-a", 2, "face-c", 1);
Portal("face-b", 0, "face-c", 2);
Portal("face-b", 2, "face-d", 0);
Portal("face-c", 0, "face-d", 2);

face_a_house = house("face-a-centerpiece", {
  position: [0, 0, 0],
  scale: 3,
});

face_a_marmot = geodesic_marmot("face-a-geodesci-marmot", {
  position: [-2.2, 0, 2.2],
  scale: 1.05,
  velocity: [1.6, -0.7],
});

face_b_campfire = campfire("face-b-centerpiece", {
  position: [0, 0, 0],
  scale: 2,
});

face_c_tree = tree("face-c-centerpiece", {
  position: [0, 0, 0],
  scale: 1,
});

face_d_rocks = rocks("face-d-centerpiece", {
  position: [0, 0, 0],
  scale: 2,
});

OnFace("face-a", [face_a_house, face_a_marmot]);
OnFace("face-b", [face_b_campfire]);
OnFace("face-c", [face_c_tree]);
OnFace("face-d", [face_d_rocks]);
