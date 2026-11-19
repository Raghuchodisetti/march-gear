import { u } from "@/lib/utils";

/**
 * Curated photography (Unsplash). Each id was reviewed visually before use.
 * Vehicle hero shots live alongside their models in cars.ts / used-cars.ts;
 * this file holds the shared editorial, interior and environment imagery.
 */
export const IMG = {
  // Campaign / hero
  heroSilhouette: u("photo-1485291571150-772bcfc10da5"),
  heroSuvDawn: u("photo-1547245324-d777c6f05e80"),
  heroEvDusk: u("photo-1620891549027-942fdc95d3f5"),

  // Cabins & driving
  cockpit: u("photo-1610647752706-3bb12232b3ab"),
  wheelHands: u("photo-1449965408869-eaa3f722e40d"),
  driverView: u("photo-1516733968668-dbdce39c4651"),
  driverPhone: u("photo-1600320254374-ce2d293c324e"),
  speedo: u("photo-1498887960847-2a5e46312788"),
  tacho: u("photo-1517026575980-3e1e2dedeab4"),
  navScreen: u("photo-1639060015191-9d83063eab2a"),

  // Details
  headlightAudi: u("photo-1542282088-fe8426682b8f"),
  headlightRed: u("photo-1606577924006-27d39b132ae2"),
  headlightBlue: u("photo-1589750602846-60028879da9b"),
  evRedDetail: u("photo-1554744512-d6c603f27c54"),
  bmwFront: u("photo-1614026480209-cd9934144671"),
  grilleMercedes: u("photo-1514316454349-750a7fd3da3a"),
  grilleRolls: u("photo-1599912027611-484b9fc447af"),
  badgeMercedes: u("photo-1563694983011-6f4d90358083"),
  detailBlue: u("photo-1565043666747-69f6646db940"),
  detailOrange: u("photo-1515569067071-ec3b51335dd0"),
  detailSculpted: u("photo-1577473403731-a36ec9087f44"),

  // Electric
  chargePlug: u("photo-1593941707882-a5bba14938c7"),
  chargeStation: u("photo-1617886322168-72b886573c35"),

  // Retail & ownership
  showroomRed: u("photo-1518987048-93e29699e79a"),
  showroomSpot: u("photo-1568844293986-8d0400bd4745"),
  showroomDoors: u("photo-1644749700856-a82a92828a1b"),
  showroomGallery: u("photo-1583121274602-3e2820c69888"),
  showroomCoupe: u("photo-1617531653332-bd46c24f2068"),
  showroomPink: u("photo-1590362891991-f776e747a588"),
  lotRow: u("photo-1630165356623-266076eaceb6"),
  classicRow: u("photo-1526726538690-5cbf956ae2fd"),
  aerialLot: u("photo-1543465077-db45d34b88a5"),
  garage: u("photo-1545179605-1296651e9d43"),
  darkGarage: u("photo-1486006920555-c77dcf18193c"),
  signing: u("photo-1521791055366-0d553872125f"),
  service: u("photo-1605152276897-4f618f831968"),
  tyre: u("photo-1613214149922-f1809c99b414"),
  mechanic: u("photo-1615906655593-ad0386982a0f"),
  factory: u("photo-1647427060118-4911c9821b82"),

  // Editorial & lifestyle
  classicPorsches: u("photo-1534093607318-f025413f49cb"),
  autumnRoad: u("photo-1541348263662-e068662d82af"),
  monoFront: u("photo-1567808291548-fc3ee04dbcf0"),
  monoSupercar: u("photo-1617654112368-307921291f42"),
  bentleyDark: u("photo-1618418721668-0d1f72aa4bab"),
  rollsWraith: u("photo-1631295868223-63265b40d9e4"),
  camper: u("photo-1527786356703-4b100091cd2c"),
  desertSuv: u("photo-1529369623266-f5264b696110"),
  roadSunset: u("photo-1568605117036-5fe5e7bab0b7"),
  porscheSunset: u("photo-1601929862217-f1bf94503333"),
  cityTaillights: u("photo-1493238792000-8113da705763"),
  portrait: u("photo-1557296387-5358ad7997bb"),
} as const;
