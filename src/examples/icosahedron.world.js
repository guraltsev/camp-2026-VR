triangle = [
  [0, -13.333333333333334],
  [11.547005383792516, 6.666666666666667],
  [-11.547005383792516, 6.666666666666667],
];

floors = [
  floorTexture("grass1"),
  floorTexture("forest_leaves"),
  floorTexture("river_pebbles"),
  floorTexture("gravelly_sand"),
  floorTexture("red_mud_stones"),
  floorTexture("snow"),
];

faces = [
  ["face-00", ["top", "u0", "u1"]],
  ["face-01", ["top", "u1", "u2"]],
  ["face-02", ["top", "u2", "u3"]],
  ["face-03", ["top", "u3", "u4"]],
  ["face-04", ["top", "u4", "u0"]],
  ["face-05", ["u0", "l0", "u1"]],
  ["face-06", ["u1", "l1", "u2"]],
  ["face-07", ["u2", "l2", "u3"]],
  ["face-08", ["u3", "l3", "u4"]],
  ["face-09", ["u4", "l4", "u0"]],
  ["face-10", ["u1", "l0", "l1"]],
  ["face-11", ["u2", "l1", "l2"]],
  ["face-12", ["u3", "l2", "l3"]],
  ["face-13", ["u4", "l3", "l4"]],
  ["face-14", ["u0", "l4", "l0"]],
  ["face-15", ["bottom", "l1", "l0"]],
  ["face-16", ["bottom", "l2", "l1"]],
  ["face-17", ["bottom", "l3", "l2"]],
  ["face-18", ["bottom", "l4", "l3"]],
  ["face-19", ["bottom", "l0", "l4"]],
];

for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
  PolygonFace(faces[faceIndex][0], floors[faceIndex % floors.length], triangle);
}

for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
  for (let sideIndex = 0; sideIndex < 3; sideIndex += 1) {
    for (let otherFaceIndex = faceIndex + 1; otherFaceIndex < faces.length; otherFaceIndex += 1) {
      for (let otherSideIndex = 0; otherSideIndex < 3; otherSideIndex += 1) {
        faceSide = [faces[faceIndex][1][sideIndex], faces[faceIndex][1][(sideIndex + 1) % 3]];
        otherSide = [
          faces[otherFaceIndex][1][otherSideIndex],
          faces[otherFaceIndex][1][(otherSideIndex + 1) % 3],
        ];

        if (
          (faceSide[0] === otherSide[0] && faceSide[1] === otherSide[1]) ||
          (faceSide[0] === otherSide[1] && faceSide[1] === otherSide[0])
        ) {
          Portal(faces[faceIndex][0], sideIndex, faces[otherFaceIndex][0], otherSideIndex);
        }
      }
    }
  }
}

startingHouse("face-00", {
  position: [-3.0, 0, 0.6],
  scale: 1,
  turn: 12,
});

startingQuestionCube("face-00", {
  position: [-2.45, 0.05, 3.25],
  scale: 1,
  turn: -18,
  goalPages: [{
    title: "Goal",
    body: "Explore the icosahedron's twenty triangular faces. Track how far you can travel before returning near the start.",
  }],
});

runner = geo_mouse("icosahedron-runner", {
  position: [-3.4, 0, 1.2],
  turn: 94,
  speed: 1.9,
  oscillationRate: 1.5,
  oscillationMagnitude: 0.16,
});

OnFace("face-00", [runner]);
