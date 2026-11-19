import { Calculator, Fuel, HandCoins, PlugZap, Scale, Wallet, type LucideIcon } from "lucide-react";
import { IMG } from "./images";

export interface Tool {
  slug: string;
  name: string;
  short: string;
  description: string;
  href: string;
  icon: LucideIcon;
  image: string;
}

export const tools: Tool[] = [
  {
    slug: "emi-calculator",
    name: "EMI Calculator",
    short: "Plan monthly instalments",
    description: "Model down payment, tenure and interest to see exactly what you'll pay each month.",
    href: "/tools/emi-calculator",
    icon: Calculator,
    image: IMG.signing,
  },
  {
    slug: "car-loan",
    name: "Car Loan Eligibility",
    short: "Know how much you can borrow",
    description: "Estimate the loan amount you qualify for based on income and existing obligations.",
    href: "/tools/car-loan",
    icon: HandCoins,
    image: IMG.showroomDoors,
  },
  {
    slug: "mileage-calculator",
    name: "Mileage Calculator",
    short: "Real-world fuel efficiency",
    description: "Work out your actual kmpl and monthly fuel spend from a single tank.",
    href: "/tools/mileage-calculator",
    icon: Fuel,
    image: IMG.speedo,
  },
  {
    slug: "ev-vs-petrol",
    name: "EV vs Petrol",
    short: "Find your break-even point",
    description: "Compare running costs and see how quickly an electric car pays back its premium.",
    href: "/tools/ev-vs-petrol",
    icon: PlugZap,
    image: IMG.chargePlug,
  },
  {
    slug: "car-valuation",
    name: "Car Valuation",
    short: "What's your car worth?",
    description: "Get an indicative market value for your car in under a minute.",
    href: "/tools/car-valuation",
    icon: Scale,
    image: IMG.aerialLot,
  },
  {
    slug: "ownership-cost",
    name: "Ownership Cost",
    short: "The true five-year cost",
    description: "Add up fuel, insurance, service and depreciation to see the full picture.",
    href: "/tools/ownership-cost",
    icon: Wallet,
    image: IMG.service,
  },
];

export const getTool = (slug: string) => tools.find((t) => t.slug === slug);
