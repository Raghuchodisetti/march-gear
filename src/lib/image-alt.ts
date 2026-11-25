/**
 * Honest alt text for the sample catalogue photography.
 *
 * The seeded catalogue uses Unsplash stock photos (Unsplash License). Many of them are
 * *representative*: the photo on the "Tata Nexon EV" page is really a Tesla Model 3, the
 * "Hyundai Creta" shows a Hyundai Tucson, and gallery extras (cockpit, headlights…) come from
 * other cars. Alt text must describe what is actually in the picture, so for every known stock
 * photo we record what it shows and which catalogue models it genuinely depicts.
 *
 * Photos not listed here — uploads from the admin, dealers or insurers, and any new stock — are
 * assumed to show the subject they're attached to.
 */

interface StockPhoto {
  /** What the picture shows, as a phrase: "a white Tesla Model 3 on a highway". */
  shows: string;
  /** Model names (matched as whole words in the subject) this photo genuinely depicts. */
  of?: string[];
}

const STOCK: Record<string, StockPhoto> = {
  // Model hero shots
  "photo-1575090536203-2a6193126514": { shows: "a grey Hyundai Tucson" },
  "photo-1529369623266-f5264b696110": { shows: "a white SUV parked in the desert" },
  "photo-1609521263047-f8f205293f24": { shows: "a dark crossover with its headlights on in fog" },
  "photo-1617469767053-d3b523a0b982": { shows: "a silver Toyota RAV4" },
  "photo-1519641471654-76ce0107ad1b": { shows: "a white Honda CR-V on a snowy shore" },
  "photo-1621993202323-f438eec934ff": { shows: "a Toyota 4Runner with a roof light bar" },
  "photo-1547245324-d777c6f05e80": { shows: "a Toyota 4Runner at dawn" },
  "photo-1533473359331-0135ef1b58bf": { shows: "a white Ford Expedition among red rocks" },
  "photo-1619767886558-efdc259cde1a": { shows: "a black Hyundai Verna on a highway", of: ["Verna"] },
  "photo-1634737581963-5a22ba471961": { shows: "a dark blue Honda Accord" },
  "photo-1581540222194-0def2dda95b8": { shows: "a dark blue Nissan Altima" },
  "photo-1624578571415-09e9b1991929": { shows: "a Toyota Camry", of: ["Camry"] },
  "photo-1621007947382-bb3c3994e3fb": { shows: "a grey Toyota Camry", of: ["Camry"] },
  "photo-1623869675781-80aa31012a5a": { shows: "a white Toyota Corolla by the sea", of: ["Corolla", "Corolla Altis"] },
  "photo-1582639510494-c80b5de9f148": { shows: "a white Opel Astra hatchback" },
  "photo-1550355291-bbee04a92027": { shows: "a red Hyundai i30 hatchback" },
  "photo-1578659258511-4a4e7dee7344": { shows: "a grey Honda Civic in fog" },
  "photo-1610099610040-ab19f3a5ec35": { shows: "a black Mercedes-Benz S-Class", of: ["S-Class"] },
  "photo-1601362840469-51e4d8d58785": { shows: "a grey BMW 7 Series", of: ["7 Series"] },
  "photo-1546614042-7df3c24c9e5d": { shows: "a dark blue BMW 5 Series", of: ["5 Series"] },
  "photo-1540066019607-e5f69323a8dc": { shows: "a white Audi A5 coupé" },
  "photo-1517524008697-84bbe3c3fd98": { shows: "a white Audi Q5 on a snowy road", of: ["Q5"] },
  "photo-1592840062661-a5a7f78e2056": { shows: "a white Audi Q3", of: ["Q3"] },
  "photo-1520031441872-265e4ff70366": { shows: "a Mercedes-Benz G-Class", of: ["G-Class"] },
  "photo-1563720223185-11003d516935": { shows: "a black Range Rover Sport", of: ["Range Rover Sport"] },
  "photo-1594502184342-2e12f877aa73": { shows: "a silver Porsche 911", of: ["911"] },
  "photo-1614162692292-7ac56d7f7f1e": { shows: "a white Porsche 911 in the snow", of: ["911"] },
  "photo-1580274455191-1c62238fa333": { shows: "a black Porsche 911", of: ["911"] },
  "photo-1503376780353-7e6692767b70": { shows: "a black Porsche Panamera on a motorway", of: ["Panamera"] },
  "photo-1601929862217-f1bf94503333": { shows: "a dark Porsche at sunset" },
  "photo-1606016159991-dfe4f2746ad5": { shows: "a white Tesla Model 3 on a highway" },
  "photo-1620891549027-942fdc95d3f5": { shows: "a Tesla Model S at dusk" },
  "photo-1560958089-b8a1929cea89": { shows: "a white Tesla Model 3 in the hills" },
  "photo-1646029642262-022158ff5794": { shows: "a red Hyundai Tucson" },
  "photo-1536700503339-1e4b06520771": { shows: "a black Tesla Model S on the road" },
  "photo-1600661653561-629509216228": { shows: "a white Tesla Model Y", of: ["Model Y"] },
  "photo-1584060622420-0673aad46076": { shows: "a Porsche Taycan", of: ["Taycan"] },
  // Pre-owned listings and upcoming models
  "photo-1494976388531-d1058494cdd8": { shows: "a black Ford Mustang", of: ["Mustang"] },
  "photo-1541899481282-d53bffe3c35d": { shows: "a blue Volkswagen Polo", of: ["Polo"] },
  "photo-1556189250-72ba954cfc2b": { shows: "a black BMW M4 coupé" },
  "photo-1504215680853-026ed2a45def": { shows: "an orange Audi A5", of: ["A5", "A5 Sportback"] },
  "photo-1507136566006-cfc505b114fc": { shows: "a red Jaguar F-Type", of: ["F-Type"] },
  "photo-1570733577524-3a047079e80d": { shows: "a grey Mercedes-Benz hatchback on cobbles" },
  "photo-1489824904134-891ab64532f1": { shows: "an orange Volkswagen Beetle", of: ["Beetle"] },
  "photo-1611859266238-4b98091d9d9b": { shows: "a dark Nissan GT-R in the mountains", of: ["GT-R"] },
  "photo-1568605117036-5fe5e7bab0b7": { shows: "a Nissan GT-R on a country road at sunset", of: ["GT-R"] },
  "photo-1549317661-bd32c8ce0db2": { shows: "a light blue Fiat 500", of: ["500"] },
  "photo-1523983388277-336a66bf9bcd": { shows: "a black BMW 6 Series Gran Coupé" },
  "photo-1638618164682-12b986ec2a75": { shows: "a white Toyota Corolla", of: ["Corolla", "Corolla Altis"] },
  "photo-1590362891991-f776e747a588": { shows: "a white Mercedes-Benz C-Class coupé", of: ["C-Class", "C-Class Coupe"] },
  "photo-1541443131876-44b03de101c5": { shows: "a blue BMW M2", of: ["M2"] },
  "photo-1603386329225-868f9b1ee6c9": { shows: "a blue BMW M2 at sunset", of: ["M2"] },
  "photo-1559416523-140ddc3d238c": { shows: "a Toyota Tacoma pickup" },
  "photo-1583267746897-2cf415887172": { shows: "a black Mercedes-AMG GT" },
  "photo-1537984822441-cff330075342": { shows: "a white BMW 2 Series coupé" },
  // Shared details used in model galleries (src/data/images.ts)
  "photo-1610647752706-3bb12232b3ab": { shows: "a pickup truck's dashboard with a large touchscreen" },
  "photo-1606577924006-27d39b132ae2": { shows: "the front of a red Audi RS" },
  "photo-1449965408869-eaa3f722e40d": { shows: "a driver's hands on the steering wheel at sunset" },
  "photo-1516733968668-dbdce39c4651": { shows: "a driver at the wheel, seen from the back seat" },
  "photo-1613214149922-f1809c99b414": { shows: "a mechanic tightening a wheel" },
  "photo-1589750602846-60028879da9b": { shows: "the headlight of a blue Mercedes-AMG GT" },
  "photo-1498887960847-2a5e46312788": { shows: "a speedometer" },
  "photo-1517026575980-3e1e2dedeab4": { shows: "an illuminated rev counter" },
  "photo-1542282088-fe8426682b8f": { shows: "an Audi headlight lit in blue" },
  "photo-1565043666747-69f6646db940": { shows: "the nose of a blue Mazda in a row of cars" },
  "photo-1514316454349-750a7fd3da3a": { shows: "the grille of a Mercedes-AMG GT" },
  "photo-1563694983011-6f4d90358083": { shows: "a Mercedes-Benz bonnet star" },
  "photo-1614026480209-cd9934144671": { shows: "the front of a BMW M3" },
  "photo-1486006920555-c77dcf18193c": { shows: "a car in a dimly lit workshop" },
  "photo-1593941707882-a5bba14938c7": { shows: "a charging cable plugged into an electric car" },
  "photo-1639060015191-9d83063eab2a": { shows: "a navigation map on a car's screen" },
  "photo-1617886322168-72b886573c35": { shows: "electric cars charging in a car park" },
  "photo-1600320254374-ce2d293c324e": { shows: "a driver with a phone mounted on the dashboard" },
  "photo-1554744512-d6c603f27c54": { shows: "the headlight of a red Tesla" },
};

const photoId = (src: string) => /photo-\d+-[0-9a-f]+/.exec(src)?.[0];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** What a known stock photo shows, or null for uploads and photos we haven't catalogued. */
export function stockPhoto(src: string): StockPhoto | null {
  const id = photoId(src);
  return (id && STOCK[id]) || null;
}

/** True when the photo shows the named car (or isn't a catalogued stock photo, e.g. an upload). */
export function photoShows(src: string, subject: string) {
  const s = stockPhoto(src);
  if (!s) return true;
  return Boolean(s.of?.some((m) => new RegExp(`(^|[^\\w-])${escape(m)}($|[^\\w-])`, "i").test(subject)));
}

/**
 * Alt text for a car photo in a gallery or feature where the picture is the content:
 * "Mercedes-Benz S-Class" when the photo really is one, otherwise
 * "Tata Nexon EV — representative photo: a white Tesla Model 3 on a highway".
 */
export function carPhotoAlt(src: string, subject: string, view?: string) {
  const s = stockPhoto(src);
  if (!s || photoShows(src, subject)) return view ? `${subject} — ${view}` : subject;
  return `${subject} — representative photo: ${s.shows}`;
}

/** For a picture that isn't of one specific car (an article or brand hero): what it shows, or the fallback. */
export function describePhoto(src: string, fallback: string) {
  const s = stockPhoto(src);
  return s ? `Photo: ${s.shows}` : fallback;
}

/**
 * Alt text for a car photo on a card or row whose visible text already names the car:
 * the name when the photo shows that car, empty (decorative) when it's a stand-in, so a
 * screen reader isn't told a Tesla is a Tata.
 */
export function cardPhotoAlt(src: string, subject: string) {
  return photoShows(src, subject) ? subject : "";
}
