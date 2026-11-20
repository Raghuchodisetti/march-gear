import type { Article } from "@/types";
import { u } from "@/lib/utils";
import { IMG } from "@/data/images";

/**
 * Desk stories added after launch so every /news category has coverage.
 * Seeded alongside the launch newsroom (inserted by slug when missing).
 * Editorial content is fictional and written for demonstration.
 */
export const extraArticles: Article[] = [
  {
    slug: "march-gear-awards-2026-shortlist",
    title: "March Gear Awards 2026: the shortlist is out",
    dek: "Thirty-three cars tested, four judges, one very long spreadsheet. These are the eight contenders for Car of the Year.",
    category: "News",
    authorId: "aditi",
    publishedOn: "2026-11-16",
    readMinutes: 5,
    image: IMG.showroomSpot,
    tags: ["Awards", "March Gear", "SUV"],
    relatedCar: "toyota-innova-hycross",
    pullQuote: "We did not ask which car is best. We asked which car we would recommend to a friend without a single caveat.",
    body: [
      "Every year our road-test team drives every new car launched in India, and every year the argument over which one deserves the top prize starts earlier. This year it began in March.",
      "The 2026 shortlist spans a wider price range than ever: from a ₹7 lakh hatchback that has rewritten the rules on safety to an electric coupé-SUV that has made long-distance EV travel feel ordinary.",
      "Our judging is simple. Each car is scored on design, comfort, performance, technology and value, then weighed against its direct rivals rather than the whole market. A great budget car can beat a great luxury car.",
      "The shortlisted eight are the Hyundai Creta, Mahindra XEV 9e, Toyota Innova Hycross, Tata Nexon, Skoda Slavia, BYD Seal, Range Rover Sport and Porsche 911.",
      "Winners will be announced on 12 December. Until then, the debate continues in the office — and in the comments.",
    ],
  },
  {
    slug: "home-ev-charging-explained",
    title: "Home charging, decoded: what a 7.4 kW wallbox really costs",
    dek: "Installation, sanctioned load, tariffs and the overnight maths. Everything you need to know before you plug in at home.",
    category: "Electric",
    authorId: "meera",
    publishedOn: "2026-11-08",
    readMinutes: 7,
    image: IMG.chargePlug,
    tags: ["Electric", "Charging", "Ownership"],
    relatedCar: "tata-nexon-ev",
    pullQuote: "For most owners, the cheapest kilometre they will ever drive starts in their own parking spot.",
    body: [
      "More than four in five EV owners in India charge mostly at home. It is cheaper, more convenient and kinder to the battery than frequent fast charging — but getting set up involves more than buying a cable.",
      "A 7.4 kW AC wallbox is the sweet spot for most cars sold today. It will take a typical 45 kWh battery from 10 to 100 per cent in around six and a half hours, comfortably within an overnight window.",
      "Installation usually costs between ₹8,000 and ₹20,000 depending on cable length and whether your building's sanctioned load needs to be increased. Many carmakers bundle a wallbox and basic installation with the car.",
      "At an indicative residential tariff of ₹8 per unit, a full charge for a 45 kWh pack costs roughly ₹360. That works out to just over ₹1 per kilometre in real-world driving, against ₹6–7 for a comparable petrol SUV.",
      "In apartment complexes, start with your resident welfare association. A growing number of societies now offer shared, metered charging bays — and several states have published guidelines that make approval easier.",
    ],
  },
  {
    slug: "s-class-back-seat-video",
    title: "Video: A morning in the back of the Mercedes-Benz S-Class",
    dek: "We swap the driver's seat for the executive rear and spend a Mumbai rush hour finding out what ₹1.8 crore of comfort feels like.",
    category: "Video",
    authorId: "aditi",
    publishedOn: "2026-10-24",
    readMinutes: 3,
    // Same photograph as the S-Class catalogue entry.
    image: u("photo-1610099610040-ab19f3a5ec35"),
    relatedCar: "mercedes-s-class",
    videoDuration: "11:47",
    tags: ["Mercedes-Benz", "Luxury", "Video"],
    body: [
      "Most S-Class owners in India never drive their car, so we didn't either. In this film, we spend a morning in the executive rear seat through Mumbai's notorious peak-hour traffic.",
      "We test the massage programmes, the rear entertainment screens and the reclining seat with leg rest — and ask whether rear-axle steering really makes a 5.3-metre limousine easy in the city.",
      "Stay to the end for our verdict on the S 350d and how it compares with the BMW 7 Series.",
    ],
  },
];
