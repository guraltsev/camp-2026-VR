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
  ["face-0", ["px", "py", "pz"]],
  ["face-1", ["py", "nx", "pz"]],
  ["face-2", ["nx", "ny", "pz"]],
  ["face-3", ["ny", "px", "pz"]],
  ["face-4", ["py", "px", "nz"]],
  ["face-5", ["nx", "py", "nz"]],
  ["face-6", ["ny", "nx", "nz"]],
  ["face-7", ["px", "ny", "nz"]],
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

startingHouse("face-0", {
  position: [-3.0, 0, 0.6],
  scale: 1,
  turn: 12,
});

startingQuestionCube("face-0", {
  position: [-2.45, 0.05, 3.25],
  scale: 1,
  turn: -18,
  goalPages: [{
    title: "Goal",
    body: "Explore the octahedron's eight triangular faces. Try to find the marker after crossing several portals.",
  }],
});

centerpiece = geo_butterfly("octahedron-butterfly", {
  position: [0, 1.5, 0],
  turn: 24,
  speed: 0.8,
  oscillationRate: 1.3,
  oscillationMagnitude: 0.25,
});

marker = traffic_cone("octahedron-marker", {
  position: [-2.8, 0, 1.4],
  scale: 0.85,
  turn: -18,
});

OnFace("face-0", [centerpiece]);
OnFace("face-4", [marker]);
