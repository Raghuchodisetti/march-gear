import type { CarModel } from "@/types";
import { brandName } from "./brands";
import { getCar } from "./cars";
import { formatDate, formatPrice, formatPriceRange } from "@/lib/format";

export interface CarFaq {
  id: string;
  question: string;
  answer: string;
}

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** FAQs generated from catalogue data so every model page has accurate answers. */
export function carFaqs(car: CarModel): CarFaq[] {
  const title = `${brandName(car.brand)} ${car.name}`;
  const ev = car.fuelTypes.includes("Electric");
  const variants = [...car.variants].sort((a, b) => a.price - b.price);
  const base = variants[0];
  const top = variants[variants.length - 1];
  const rivals = car.competitors
    .map((slug) => getCar(slug))
    .filter((c) => c !== undefined)
    .slice(0, 3)
    .map((c) => `${brandName(c.brand)} ${c.name}`);

  const faqs: CarFaq[] = [
    {
      id: "price",
      question: `What is the price of the ${title}?`,
      answer: `The ${title} is priced between ${formatPriceRange(car.priceMin, car.priceMax)} (ex-showroom, indicative). The range starts with the ${base.name} at ${formatPrice(base.price)} and tops out with the ${top.name} at ${formatPrice(top.price)}. On-road prices vary by city once registration, insurance and other charges are added.`,
    },
    ev && car.ev
      ? {
          id: "range",
          question: `What is the range of the ${title}?`,
          answer: `The ${title} has a claimed range of up to ${car.ev.rangeKm} km from its ${car.ev.batteryKwh} kWh battery. Expect roughly ${Math.round(car.ev.rangeKm * 0.78)} km in mixed real-world driving, depending on speed, climate-control use and terrain.`,
        }
      : {
          id: "mileage",
          question: `What is the mileage of the ${title}?`,
          answer: `The claimed fuel efficiency of the ${title} is ${car.efficiency}, depending on the fuel type and transmission. Real-world figures are typically 15–25% lower in heavy city traffic.`,
        },
    {
      id: "safety",
      question: `What is the safety rating of the ${title}?`,
      answer:
        car.safetyAgency === "Not tested"
          ? `The ${title} has not been crash-tested by an independent NCAP programme. It is equipped with ${car.airbags} airbags as standard on most variants.`
          : `The ${title} has a ${car.safetyRating}-star rating from ${car.safetyAgency} and is equipped with up to ${car.airbags} airbags.`,
    },
    {
      id: "seating",
      question: `How many people can the ${title} seat?`,
      answer:
        car.seats.length > 1
          ? `The ${title} is available in ${list(car.seats.map((s) => `${s}-seat`))} configurations.`
          : `The ${title} is a ${car.seats[0]}-seater.`,
    },
    {
      id: "boot",
      question: `What is the boot space of the ${title}?`,
      answer: `The ${title} offers ${car.bootSpace} litres of luggage space${car.seats.some((s) => s > 5) ? " with the rear-most row in use; folding it frees up considerably more" : ""}.`,
    },
    {
      id: "variants",
      question: `How many variants of the ${title} are available?`,
      answer: `There are ${car.variants.length} variants: ${list(variants.map((v) => v.name))}. Fuel options include ${list(car.fuelTypes.map((f) => f.toLowerCase()))}, with ${list(car.transmissions.map((t) => (t === "Manual" ? "manual" : t === "Automatic" ? "automatic" : t)))} gearboxes.`,
    },
  ];

  if (ev && car.ev) {
    faqs.push({
      id: "charging",
      question: `How long does the ${title} take to charge?`,
      answer: `On a DC fast charger the ${title} takes about ${car.ev.dcCharge}. On an AC wallbox at home, a full charge takes around ${car.ev.acCharge}.`,
    });
  }

  if (car.launchedOn) {
    faqs.push({
      id: "launch",
      question: `When was the ${title} launched?`,
      answer: `The ${title} was launched in India on ${formatDate(car.launchedOn)}.`,
    });
  }

  if (rivals.length) {
    faqs.push({
      id: "rivals",
      question: `Which cars does the ${title} compete with?`,
      answer: `Its closest rivals include the ${list(rivals)}. Use March Gear's compare tool to see them side by side.`,
    });
  }

  return faqs;
}
