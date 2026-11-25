import type { CarModel } from "@/types";
import type { Catalog } from "@/lib/catalog";
import { formatDate, formatPrice, formatPriceRange } from "@/lib/format";
import { known } from "@/lib/specs";

export interface CarFaq {
  id: string;
  question: string;
  answer: string;
}

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** FAQs generated from catalogue data so every model page has accurate answers (questions whose answer isn't published are left out). */
export function carFaqs(car: CarModel, cat: Catalog): CarFaq[] {
  const { brandName, getCar } = cat;
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

  const airbags = known(car.airbags);
  const faqs: (CarFaq | null)[] = [
    {
      id: "price",
      question: `What is the price of the ${title}?`,
      answer: `The ${title} is priced between ${formatPriceRange(car.priceMin, car.priceMax)} (${car.priceCity ? `ex-showroom ${car.priceCity}` : "ex-showroom, indicative"}). The range starts with the ${base.name} at ${formatPrice(base.price)} and tops out with the ${top.name} at ${formatPrice(top.price)}. On-road prices vary by city once registration, insurance and other charges are added.`,
    },
    ev && car.ev
      ? {
          id: "range",
          question: `What is the range of the ${title}?`,
          answer: `The ${title} has a claimed range of up to ${car.ev.rangeKm} km from its ${car.ev.batteryKwh} kWh battery. Expect roughly ${Math.round(car.ev.rangeKm * 0.78)} km in mixed real-world driving, depending on speed, climate-control use and terrain.`,
        }
      : car.efficiency
        ? {
            id: "mileage",
            question: `What is the mileage of the ${title}?`,
            answer: `The claimed fuel efficiency of the ${title} is ${car.efficiency}, depending on the fuel type and transmission. Real-world figures are typically 15–25% lower in heavy city traffic.`,
          }
        : null,
    {
      id: "safety",
      question: `What is the safety rating of the ${title}?`,
      answer:
        car.safetyAgency === "Not tested"
          ? `No independent NCAP crash-test result has been published for this generation of the ${title}.${airbags ? ` It is equipped with up to ${airbags} airbags.` : ""}`
          : `The ${title} has a ${car.safetyRating}-star rating from ${car.safetyAgency}${airbags ? ` and is equipped with up to ${airbags} airbags` : ""}.`,
    },
    {
      id: "seating",
      question: `How many people can the ${title} seat?`,
      answer:
        car.seats.length > 1
          ? `The ${title} is available in ${list(car.seats.map((s) => `${s}-seat`))} configurations.`
          : `The ${title} is a ${car.seats[0]}-seater.`,
    },
    known(car.bootSpace)
      ? {
          id: "boot",
          question: `What is the boot space of the ${title}?`,
          answer: `The ${title} offers ${car.bootSpace} litres of luggage space${car.seats.some((s) => s > 5) ? " with the rear-most row in use; folding it frees up considerably more" : ""}.`,
        }
      : null,
    {
      id: "variants",
      question: `How many variants of the ${title} are available?`,
      answer: `There are ${car.variants.length} variants: ${list(variants.map((v) => v.name))}. Fuel options include ${list(car.fuelTypes.map((f) => f.toLowerCase()))}, with ${list(car.transmissions.map((t) => (t === "Manual" ? "manual" : t === "Automatic" ? "automatic" : t)))} gearboxes.`,
    },
  ];
  const out = faqs.filter((f): f is CarFaq => f !== null);

  if (ev && car.ev && (car.ev.dcCharge || car.ev.acCharge)) {
    const dc = car.ev.dcCharge ? `On a DC fast charger the ${title} takes about ${car.ev.dcCharge}.` : "";
    const ac = car.ev.acCharge ? `On an AC wallbox at home, a full charge takes around ${car.ev.acCharge}.` : "";
    out.push({ id: "charging", question: `How long does the ${title} take to charge?`, answer: [dc, ac].filter(Boolean).join(" ") });
  }

  if (car.launchedOn) {
    out.push({
      id: "launch",
      question: `When was the ${title} launched?`,
      answer: `The ${title} was launched in India on ${formatDate(car.launchedOn)}.`,
    });
  }

  if (rivals.length) {
    out.push({
      id: "rivals",
      question: `Which cars does the ${title} compete with?`,
      answer: `Its closest rivals include the ${list(rivals)}. Use March Gear's compare tool to see them side by side.`,
    });
  }

  return out;
}
