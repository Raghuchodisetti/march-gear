import { IMG } from "./images";
import { u } from "@/lib/utils";

export interface NavLink {
  label: string;
  href: string;
  note?: string;
}

export interface MegaColumn {
  title: string;
  links: NavLink[];
}

export interface MegaFeature {
  eyebrow: string;
  title: string;
  href: string;
  image: string;
  cta: string;
}

export interface NavItem {
  key: string;
  label: string;
  shortLabel?: string;
  href: string;
  mega?: { columns: MegaColumn[]; feature: MegaFeature; chips?: NavLink[] };
}

export const announcements: { tag: string; text: string; href: string }[] = [
  { tag: "Launched", text: "Mahindra XEV 9e Pack Three — 656 km claimed range", href: "/cars/mahindra-xev-9e" },
  { tag: "Electric", text: "EVs cross 6% of passenger car sales for the first time", href: "/news/india-ev-sales-october-2026" },
  { tag: "Offer", text: "Free 200-point inspection on every verified used car", href: "/used-cars" },
];

export const mainNav: NavItem[] = [
  {
    key: "new",
    label: "New Cars",
    href: "/new-cars",
    mega: {
      columns: [
        {
          title: "Explore",
          links: [
            { label: "All new cars", href: "/new-cars" },
            { label: "Browse by brand", href: "/brands" },
            { label: "Latest launches", href: "/new-cars?sort=latest" },
            { label: "Upcoming cars", href: "/upcoming-cars", note: "8 expected" },
            { label: "Electric cars", href: "/electric-cars" },
          ],
        },
        {
          title: "Body type",
          links: [
            { label: "SUVs", href: "/new-cars?body=suv" },
            { label: "Sedans", href: "/new-cars?body=sedan" },
            { label: "Hatchbacks", href: "/new-cars?body=hatchback" },
            { label: "MUVs", href: "/new-cars?body=muv" },
            { label: "Luxury", href: "/new-cars?body=luxury" },
          ],
        },
        {
          title: "Budget",
          links: [
            { label: "Under ₹8 Lakh", href: "/new-cars?budget=under-8" },
            { label: "₹8 – 15 Lakh", href: "/new-cars?budget=8-15" },
            { label: "₹15 – 25 Lakh", href: "/new-cars?budget=15-25" },
            { label: "₹25 – 50 Lakh", href: "/new-cars?budget=25-50" },
            { label: "Above ₹1 Crore", href: "/new-cars?budget=above-1cr" },
          ],
        },
      ],
      chips: [
        { label: "Maruti Suzuki", href: "/brands/maruti-suzuki" },
        { label: "Hyundai", href: "/brands/hyundai" },
        { label: "Tata", href: "/brands/tata" },
        { label: "Mahindra", href: "/brands/mahindra" },
        { label: "Toyota", href: "/brands/toyota" },
        { label: "BMW", href: "/brands/bmw" },
        { label: "Mercedes-Benz", href: "/brands/mercedes-benz" },
        { label: "Porsche", href: "/brands/porsche" },
      ],
      feature: {
        eyebrow: "Just launched",
        title: "Mahindra XEV 9e",
        href: "/cars/mahindra-xev-9e",
        image: IMG.heroEvDusk,
        cta: "Explore the car",
      },
    },
  },
  {
    key: "used",
    label: "Used Cars",
    href: "/used-cars",
    mega: {
      columns: [
        {
          title: "Buy",
          links: [
            { label: "All used cars", href: "/used-cars" },
            { label: "Verified inventory", href: "/used-cars?verified=1", note: "200-point check" },
            { label: "Used SUVs", href: "/used-cars?body=SUV" },
            { label: "Pre-owned luxury", href: "/used-cars?budget=luxury" },
            { label: "Find a dealer", href: "/dealers" },
          ],
        },
        {
          title: "By city",
          links: [
            { label: "Mumbai", href: "/used-cars?city=Mumbai" },
            { label: "New Delhi", href: "/used-cars?city=New%20Delhi" },
            { label: "Bengaluru", href: "/used-cars?city=Bengaluru" },
            { label: "Hyderabad", href: "/used-cars?city=Hyderabad" },
            { label: "Pune", href: "/used-cars?city=Pune" },
          ],
        },
        {
          title: "Sell",
          links: [
            { label: "Sell your car", href: "/sell-car" },
            { label: "Free car valuation", href: "/tools/car-valuation" },
            { label: "How selling works", href: "/sell-car#how-it-works" },
          ],
        },
      ],
      feature: {
        eyebrow: "Sell in 24 hours",
        title: "Get an instant, fair price for your car",
        href: "/sell-car",
        image: IMG.signing,
        cta: "Start valuation",
      },
    },
  },
  { key: "ev", label: "Electric Vehicles", shortLabel: "Electric", href: "/electric-cars" },
  { key: "pdi", label: "PDI Check", href: "/pdi-check" },
  { key: "compare", label: "Compare", href: "/compare" },
  {
    key: "reviews",
    label: "Reviews",
    href: "/reviews",
    mega: {
      columns: [
        {
          title: "Reviews",
          links: [
            { label: "Expert reviews", href: "/reviews" },
            { label: "Owner reviews", href: "/reviews/owners" },
            { label: "Test drives", href: "/news?category=First%20Drive" },
            { label: "Car videos", href: "/news?category=Video" },
          ],
        },
        {
          title: "Popular",
          links: [
            { label: "Hyundai Creta", href: "/cars/hyundai-creta#reviews" },
            { label: "Mahindra XUV700", href: "/cars/mahindra-xuv700#reviews" },
            { label: "Toyota Innova Hycross", href: "/cars/toyota-innova-hycross#reviews" },
            { label: "Porsche 911", href: "/cars/porsche-911#reviews" },
          ],
        },
      ],
      feature: {
        eyebrow: "Comparison",
        title: "Creta vs Hyryder vs Elevate — which to buy?",
        href: "/news/creta-vs-hyryder-vs-elevate",
        image: u("photo-1575090536203-2a6193126514"),
        cta: "Read the verdict",
      },
    },
  },
  { key: "news", label: "News & Media", shortLabel: "News", href: "/news" },
  {
    key: "tools",
    label: "Tools",
    href: "/tools",
    mega: {
      columns: [
        {
          title: "Finance",
          links: [
            { label: "EMI calculator", href: "/tools/emi-calculator" },
            { label: "Car loan eligibility", href: "/tools/car-loan" },
            { label: "Ownership cost", href: "/tools/ownership-cost" },
          ],
        },
        {
          title: "Running costs",
          links: [
            { label: "Mileage calculator", href: "/tools/mileage-calculator" },
            { label: "EV vs Petrol", href: "/tools/ev-vs-petrol" },
            { label: "Car valuation", href: "/tools/car-valuation" },
          ],
        },
      ],
      feature: {
        eyebrow: "Compare",
        title: "Line up to four cars side by side",
        href: "/compare",
        image: IMG.lotRow,
        cta: "Start comparing",
      },
    },
  },
];

export const footerColumns: MegaColumn[] = [
  {
    title: "New Cars",
    links: [
      { label: "All new cars", href: "/new-cars" },
      { label: "Car brands", href: "/brands" },
      { label: "Latest launches", href: "/new-cars?sort=latest" },
      { label: "Upcoming cars", href: "/upcoming-cars" },
      { label: "Electric cars", href: "/electric-cars" },
    ],
  },
  {
    title: "Used Cars",
    links: [
      { label: "Buy used cars", href: "/used-cars" },
      { label: "Verified cars", href: "/used-cars?verified=1" },
      { label: "Sell your car", href: "/sell-car" },
      { label: "Car valuation", href: "/tools/car-valuation" },
      { label: "Dealer network", href: "/dealers" },
    ],
  },
  {
    title: "Research",
    links: [
      { label: "Compare cars", href: "/compare" },
      { label: "Expert reviews", href: "/reviews" },
      { label: "Owner reviews", href: "/reviews/owners" },
      { label: "News & media", href: "/news" },
      { label: "Video reviews", href: "/news?category=Video" },
    ],
  },
  {
    title: "Tools",
    links: [
      { label: "EMI calculator", href: "/tools/emi-calculator" },
      { label: "Car loan eligibility", href: "/tools/car-loan" },
      { label: "Mileage calculator", href: "/tools/mileage-calculator" },
      { label: "EV vs Petrol", href: "/tools/ev-vs-petrol" },
      { label: "Ownership cost", href: "/tools/ownership-cost" },
    ],
  },
];

export const footerLegal: NavLink[] = [
  { label: "About us", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms & conditions", href: "/terms" },
];
