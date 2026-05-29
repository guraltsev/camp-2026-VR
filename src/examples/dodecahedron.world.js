pentagon = [
  [0, -8],
  [7.608452130361228, -2.4721359549995796],
  [4.702282018339785, 6.47213595499958],
  [-4.702282018339784, 6.47213595499958],
  [-7.608452130361229, -2.4721359549995787],
];

grass_floor = floorTexture("grass1");
leaves_floor = floorTexture("forest_leaves");
pebble_floor = floorTexture("river_pebbles");
sand_floor = floorTexture("gravelly_sand");
mud_floor = floorTexture("red_mud_stones");
snow_floor = floorTexture("snow");

PolygonFace("top", grass_floor, pentagon);
PolygonFace("upper-0", leaves_floor, pentagon);
PolygonFace("upper-1", pebble_floor, pentagon);
PolygonFace("upper-2", sand_floor, pentagon);
PolygonFace("upper-3", mud_floor, pentagon);
PolygonFace("upper-4", snow_floor, pentagon);
PolygonFace("lower-0", grass_floor, pentagon);
PolygonFace("lower-1", leaves_floor, pentagon);
PolygonFace("lower-2", pebble_floor, pentagon);
PolygonFace("lower-3", sand_floor, pentagon);
PolygonFace("lower-4", mud_floor, pentagon);
PolygonFace("bottom", snow_floor, pentagon);

Portal("top", 0, "upper-0", 0);
Portal("top", 1, "upper-1", 0);
Portal("top", 2, "upper-2", 0);
Portal("top", 3, "upper-3", 0);
Portal("top", 4, "upper-4", 0);

Portal("upper-0", 1, "upper-1", 4);
Portal("upper-1", 1, "upper-2", 4);
Portal("upper-2", 1, "upper-3", 4);
Portal("upper-3", 1, "upper-4", 4);
Portal("upper-4", 1, "upper-0", 4);

Portal("upper-0", 2, "lower-0", 0);
Portal("upper-1", 2, "lower-1", 0);
Portal("upper-2", 2, "lower-2", 0);
Portal("upper-3", 2, "lower-3", 0);
Portal("upper-4", 2, "lower-4", 0);

Portal("upper-0", 3, "lower-4", 1);
Portal("upper-1", 3, "lower-0", 1);
Portal("upper-2", 3, "lower-1", 1);
Portal("upper-3", 3, "lower-2", 1);
Portal("upper-4", 3, "lower-3", 1);

Portal("lower-0", 3, "lower-1", 4);
Portal("lower-1", 3, "lower-2", 4);
Portal("lower-2", 3, "lower-3", 4);
Portal("lower-3", 3, "lower-4", 4);
Portal("lower-4", 3, "lower-0", 4);

Portal("bottom", 0, "lower-0", 2);
Portal("bottom", 1, "lower-1", 2);
Portal("bottom", 2, "lower-2", 2);
Portal("bottom", 3, "lower-3", 2);
Portal("bottom", 4, "lower-4", 2);

top_house = small_house("top-house", {
  position: [0, 0, 0],
  scale: 0.9,
});

top_mouse = geo_mouse("top-geo-mouse", {
  position: [-3.2, 0, -1.7],
  turn: 67,
  speed: 1.9,
  oscillationRate: 1.4,
  oscillationMagnitude: 0.16,
});

upper_0_house = small_house("upper-0-house", {
  position: [-1.6, 0, 0.8],
  scale: 0.85,
  turn: 20,
});

upper_1_tree = tree("upper-1-tree", {
  position: [0.6, 0, 0.4],
  turn: -23,
});

upper_2_butterfly = geo_butterfly("upper-2-butterfly", {
  position: [0.2, 1.5, -0.7],
  turn: 40,
  speed: 0.8,
  oscillationRate: 1.5,
  oscillationMagnitude: 0.28,
});

upper_3_grass = grass("upper-3-grass", {
  position: [0.3, 0, 0.1],
  scale: 1.1,
  turn: 29,
});

upper_4_tree = tree("upper-4-tree", {
  position: [-0.5, 0, -0.5],
  turn: -14,
});

bottom_house = small_house("bottom-house", {
  position: [0, 0, 0],
  scale: 0.8,
});

OnFace("top", [top_house, top_mouse]);
OnFace("upper-0", [upper_0_house]);
OnFace("upper-1", [upper_1_tree]);
OnFace("upper-2", [upper_2_butterfly]);
OnFace("upper-3", [upper_3_grass]);
OnFace("upper-4", [upper_4_tree]);
OnFace("bottom", [bottom_house]);
