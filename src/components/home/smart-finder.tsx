"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Search } from "lucide-react";
import { BUDGETS, carCategories, inBudget } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Segmented } from "@/components/ui/field";
import { Reveal } from "@/components/ui/reveal";
import { useCity } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";

const BODY = [
  { value: "suv", label: "SUV", used: "SUV" },
  { value: "sedan", label: "Sedan", used: "Sedan" },
  { value: "hatchback", label: "Hatchback", used: "Hatchback" },
  { value: "muv", label: "MUV", used: "MUV" },
  { value: "luxury", label: "Luxury", used: "" },
  { value: "electric", label: "Electric", used: "" },
];
const FUEL = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];
const TRANSMISSION = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
];

type Mode = "new" | "used";

export function SmartFinder() {
  const router = useRouter();
  const { city, setCity } = useCity();
  const { cars, usedCars, brands, cities } = useCatalog();
  const [mode, setMode] = useState<Mode>("new");
  const [budget, setBudget] = useState("");
  const [body, setBody] = useState("");
  const [fuel, setFuel] = useState("");
  const [transmission, setTransmission] = useState("");
  const [brand, setBrand] = useState("");

  const newMatches = useMemo(
    () =>
      cars.filter(
        (c) =>
          (!budget || inBudget(c, budget)) &&
          (!body || carCategories(c).includes(body as never)) &&
          (!fuel || c.fuelTypes.includes(fuel as never)) &&
          (!transmission || (transmission === "manual" ? c.transmissions.includes("Manual") : c.transmissions.some((t) => t !== "Manual"))) &&
          (!brand || c.brand === brand),
      ),
    [cars, budget, body, fuel, transmission, brand],
  );

  const usedMatches = useMemo(() => {
    const band = BUDGETS.find((b) => b.slug === budget);
    const bodyType = BODY.find((b) => b.value === body)?.used;
    return usedCars.filter(
      (c) =>
        (!band || (c.price >= band.min && c.price < band.max)) &&
        (!body || (bodyType ? c.bodyType === bodyType : body === "luxury" ? c.price >= 3_000_000 : c.fuel === "Electric")) &&
        (!fuel || c.fuel === fuel) &&
        (!transmission || (transmission === "manual" ? c.transmission === "Manual" : c.transmission !== "Manual")) &&
        (!brand || c.brand === brand),
    );
  }, [usedCars, budget, body, fuel, transmission, brand]);

  const matches = mode === "new" ? newMatches : usedMatches;
  const previews = matches.slice(0, 4).map((m) => m.images[0]);

  const submit = () => {
    const params = new URLSearchParams();
    if (mode === "new") {
      if (budget) params.set("budget", budget);
      if (body) params.set("body", body);
      if (fuel) params.set("fuel", fuel.toLowerCase());
      if (transmission) params.set("transmission", transmission);
      if (brand) params.set("brand", brand);
      if (!params.size) params.set("show", "all");
      router.push(`/new-cars?${params}`);
    } else {
      params.set("city", city.name);
      const bodyType = BODY.find((b) => b.value === body)?.used;
      if (bodyType) params.set("body", bodyType);
      if (body === "luxury") params.set("budget", "luxury");
      if (fuel) params.set("fuel", fuel.toLowerCase());
      if (brand) params.set("brand", brand);
      router.push(`/used-cars?${params}`);
    }
  };

  const reset = () => {
    setBudget("");
    setBody("");
    setFuel("");
    setTransmission("");
    setBrand("");
  };
  const active = [budget, body, fuel, transmission, brand].filter(Boolean).length;

  return (
    <section aria-labelledby="finder-title" className="relative z-10 -mt-16">
      <div className="container-x">
        <Reveal y={40} className="border border-line bg-white shadow-lift">
          <div className="flex flex-col gap-5 border-b border-line px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
            <div>
              <p className="type-eyebrow flex items-center gap-3 text-muted">
                <span aria-hidden className="h-px w-6 bg-red" />
                Smart car finder
              </p>
              <h2 id="finder-title" className="type-h3 mt-3">
                Tell us what matters. We&apos;ll narrow the field.
              </h2>
            </div>
            <Segmented<Mode>
              ariaLabel="Search new or used cars"
              value={mode}
              onChange={setMode}
              options={[
                { value: "new", label: "New cars" },
                { value: "used", label: "Used cars" },
              ]}
              className="self-start md:self-auto"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6">
            <Cell label="Budget" value={budget} onChange={setBudget} placeholder="Any budget" options={BUDGETS.map((b) => ({ value: b.slug, label: b.label }))} />
            <Cell label="Body type" value={body} onChange={setBody} placeholder="Any type" options={BODY.map((b) => ({ value: b.value, label: b.label }))} />
            <Cell label="Fuel type" value={fuel} onChange={setFuel} placeholder="Any fuel" options={FUEL.map((f) => ({ value: f, label: f }))} />
            <Cell label="Transmission" value={transmission} onChange={setTransmission} placeholder="Any gearbox" options={TRANSMISSION} />
            <Cell label="Brand" value={brand} onChange={setBrand} placeholder="All brands" options={brands.map((b) => ({ value: b.slug, label: b.name }))} />
            <Cell
              label="Location"
              value={city.slug}
              onChange={(v) => setCity(v)}
              options={cities.map((c) => ({ value: c.slug, label: c.name }))}
            />
          </div>

          <div className="flex flex-col gap-4 border-t border-line px-5 py-4 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="flex min-h-10 items-center gap-4" aria-live="polite">
              <div className="flex -space-x-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {previews.map((src, i) => (
                    <motion.span
                      key={src + i}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="relative size-10 overflow-hidden rounded-full border-2 border-white bg-mist"
                    >
                      <Image src={src} alt="" fill sizes="40px" className="object-cover" />
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
              <p className="text-[14px]">
                <motion.span key={matches.length} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className="font-semibold num">
                  {matches.length}
                </motion.span>{" "}
                <span className="text-muted">
                  {mode === "new" ? "new" : "used"} {matches.length === 1 ? "car matches" : "cars match"} your criteria
                </span>
              </p>
              {active > 0 && (
                <button type="button" onClick={reset} className="text-[13px] text-muted underline-offset-4 hover:text-ink hover:underline">
                  Reset
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={matches.length === 0}
              className="group inline-flex h-14 items-center justify-center gap-3 rounded-[3px] bg-red px-8 text-[15px] font-medium text-white transition-colors duration-[250ms] hover:bg-red-600 disabled:bg-line disabled:text-muted md:min-w-64"
            >
              <Search className="size-[18px]" aria-hidden />
              {matches.length === 0 ? "No matches — adjust filters" : `Show ${matches.length} ${mode === "new" ? "cars" : "listings"}`}
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Cell({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const id = `finder-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const current = options.find((o) => o.value === value)?.label ?? placeholder;
  return (
    <div className="group relative border-b border-r border-line px-5 py-4 transition-colors duration-[250ms] even:border-r-0 hover:bg-mist/70 md:px-8 lg:border-b-0 lg:px-6 lg:even:border-r lg:last:border-r-0">
      <label htmlFor={id} className="block text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className={cn("truncate text-[15px] font-semibold", !value && placeholder && "text-ink/80")}>{current}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-[250ms] group-hover:translate-y-0.5" />
      </div>
      {value && placeholder && <span aria-hidden className="absolute left-0 top-0 h-full w-[2px] bg-red" />}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
