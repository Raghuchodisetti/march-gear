/** Curated starting points for the comparison tool. Editorial copy is demo content. */
export interface PopularComparison {
  id: string;
  theme: string;
  note: string;
  cars: string[];
}

export const popularComparisons: PopularComparison[] = [
  {
    id: "midsize-suv",
    theme: "The midsize benchmark",
    note: "Three takes on India's most contested segment — turbo, hybrid and naturally aspirated.",
    cars: ["hyundai-creta", "toyota-hyryder", "honda-elevate"],
  },
  {
    id: "seven-seats",
    theme: "Seven seats, two philosophies",
    note: "A torque-rich diesel SUV against a frugal strong-hybrid MPV.",
    cars: ["mahindra-xuv700", "toyota-innova-hycross"],
  },
  {
    id: "electric-family",
    theme: "Electric for the family",
    note: "Range, rear-seat comfort and charging speed in the ₹12–25 lakh EV bracket.",
    cars: ["tata-nexon-ev", "mg-windsor-ev", "hyundai-creta-electric"],
  },
  {
    id: "flagship-limousines",
    theme: "The flagship limousines",
    note: "Rear-seat theatre and technology at the very top of the market.",
    cars: ["mercedes-s-class", "bmw-7-series"],
  },
];
