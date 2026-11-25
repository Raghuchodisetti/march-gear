"use client";

import Image from "next/image";
import { cardPhotoAlt } from "@/lib/image-alt";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Baby,
  Building2,
  Car,
  CarFront,
  Check,
  Compass,
  Fuel,
  Leaf,
  Mountain,
  Route,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CarLite } from "@/types";
import { isElectric } from "@/lib/catalog";
import { IMG } from "@/data/images";
import { formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-heading";
import { useCatalog } from "@/components/providers/catalog-provider";
import { CarImage } from "@/components/vehicle/car-image";
import { accelSeconds, known } from "@/lib/specs";

type Answers = { budget?: string; seats?: string; body?: string; usage?: string; fuel?: string };

interface Option {
  value: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
}

const QUESTIONS: { key: keyof Answers; title: string; options: Option[] }[] = [
  {
    key: "budget",
    title: "What is your budget?",
    options: [
      { value: "0-10", label: "Under ₹10 Lakh", hint: "Smart & efficient" },
      { value: "10-20", label: "₹10 – 20 Lakh", hint: "The sweet spot" },
      { value: "20-40", label: "₹20 – 40 Lakh", hint: "Premium comfort" },
      { value: "40-100", label: "₹40 Lakh – 1 Cr", hint: "Entry luxury" },
      { value: "100-1000", label: "Above ₹1 Crore", hint: "No compromise" },
    ],
  },
  {
    key: "seats",
    title: "How many passengers, usually?",
    options: [
      { value: "2", label: "Just me, or two", icon: Users },
      { value: "5", label: "Up to five", icon: Users },
      { value: "7", label: "Six or seven", icon: Baby },
    ],
  },
  {
    key: "body",
    title: "What type of vehicle do you prefer?",
    options: [
      { value: "Hatchback", label: "Hatchback", icon: Car },
      { value: "Sedan", label: "Sedan", icon: CarFront },
      { value: "SUV", label: "SUV", icon: Mountain },
      { value: "MUV", label: "MUV / MPV", icon: Users },
      { value: "any", label: "No preference", icon: Sparkles },
    ],
  },
  {
    key: "usage",
    title: "What is your primary usage?",
    options: [
      { value: "city", label: "City commute", hint: "Traffic, parking, efficiency", icon: Building2 },
      { value: "highway", label: "Highway touring", hint: "Long, fast distances", icon: Route },
      { value: "family", label: "Family trips", hint: "Space and comfort", icon: Users },
      { value: "adventure", label: "Off-road & adventure", hint: "Clearance and grip", icon: Compass },
      { value: "fun", label: "Weekend fun", hint: "Performance first", icon: Zap },
    ],
  },
  {
    key: "fuel",
    title: "Which fuel type do you prefer?",
    options: [
      { value: "Petrol", label: "Petrol", icon: Fuel },
      { value: "Diesel", label: "Diesel", icon: Fuel },
      { value: "Hybrid", label: "Hybrid", icon: Leaf },
      { value: "Electric", label: "Electric", icon: Zap },
      { value: "any", label: "Open to all", icon: Sparkles },
    ],
  },
];

const SAMPLE: Answers = { budget: "10-20", seats: "5", body: "SUV", usage: "city", fuel: "any" };

function score(car: CarLite, a: Answers) {
  let s = 0;
  const reasons: string[] = [];
  const [lo, hi] = (a.budget ?? "0-1000").split("-").map((n) => Number(n) * 100_000);
  if (car.priceMin >= lo && car.priceMin <= hi) {
    s += 32;
    reasons.push("Starts within your budget");
  } else if (car.priceMin < lo * 1.25 && car.priceMax >= lo) s += 14;
  else if (car.priceMin <= hi * 1.15) s += 8;

  const needSeats = Number(a.seats ?? 5);
  const maxSeats = Math.max(...car.seats);
  if (maxSeats >= needSeats) {
    s += 18;
    if (needSeats >= 7) reasons.push(`Seats up to ${maxSeats}`);
  }

  if (!a.body || a.body === "any") s += 10;
  else if (car.bodyType === a.body) {
    s += 20;
    const article = car.bodyType === "SUV" || car.bodyType === "MUV" ? "An" : "A";
    const noun = car.bodyType === "SUV" || car.bodyType === "MUV" ? car.bodyType : car.bodyType.toLowerCase();
    reasons.push(`${article} ${noun}, as you prefer`);
  }

  switch (a.usage) {
    case "city":
      if (car.efficiencyValue > 20 || isElectric(car) || car.fuelTypes.includes("Hybrid")) {
        s += 14;
        reasons.push(isElectric(car) ? "Ultra-low running cost in traffic" : `Efficient: ${car.efficiency}`);
      }
      break;
    case "highway":
      if (car.fuelTypes.includes("Diesel") || (known(car.topSpeed) ?? 0) >= 200) {
        s += 14;
        reasons.push("Relaxed, long-legged cruiser");
      }
      break;
    case "family":
      if (car.bootSpace >= 400 || maxSeats >= 7) {
        s += 14;
        reasons.push(car.bootSpace >= 400 ? `${car.bootSpace} L boot for luggage` : `Seats up to ${maxSeats}`);
      }
      break;
    case "adventure":
      if (car.groundClearance >= 200) {
        s += 14;
        reasons.push(`${car.groundClearance} mm ground clearance`);
      }
      break;
    case "fun":
      if ((accelSeconds(car.acceleration) ?? 99) < 8) {
        s += 14;
        reasons.push(`0–100 km/h in ${accelSeconds(car.acceleration)} s`);
      }
      break;
  }

  if (!a.fuel || a.fuel === "any") s += 8;
  else if (car.fuelTypes.includes(a.fuel as never)) {
    s += 14;
    reasons.push(`Available in ${a.fuel.toLowerCase()}`);
  }

  if (car.safetyRating >= 5) reasons.push(`5-star ${car.safetyAgency} rating`);
  s += car.expertScore * 0.6;
  return { match: Math.round(Math.min(97, 42 + s * 0.52)), reasons: reasons.slice(0, 3) };
}

export function PerfectCarQuiz() {
  const { cars } = useCatalog();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [dir, setDir] = useState(1);
  const done = step >= QUESTIONS.length;

  const results = useMemo(() => {
    if (!done) return [];
    return cars
      .map((car) => ({ car, ...score(car, answers) }))
      .sort((x, y) => y.match - x.match)
      .slice(0, 3);
  }, [done, answers, cars]);

  const choose = (key: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setDir(1);
    window.setTimeout(() => setStep((s) => s + 1), 260);
  };

  const back = () => {
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const restart = () => {
    setAnswers({});
    setDir(-1);
    setStep(0);
  };

  const sample = () => {
    setAnswers(SAMPLE);
    setDir(1);
    setStep(QUESTIONS.length);
  };

  const q = QUESTIONS[Math.min(step, QUESTIONS.length - 1)];
  const progress = Math.min(step, QUESTIONS.length) / QUESTIONS.length;

  return (
    <section aria-labelledby="quiz-title" className="py-14 md:py-20">
      <div className="container-x grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-0">
        {/* Intro panel */}
        <div className="relative isolate flex min-h-[340px] flex-col justify-between overflow-hidden bg-ink p-7 text-white md:p-10 lg:col-span-5">
          <Image src={IMG.camper} alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className="-z-10 object-cover opacity-45" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/60 to-ink/10" />
          <div>
            <Eyebrow tone="light">Find your perfect car</Eyebrow>
            <h2 id="quiz-title" className="type-h2 mt-5 max-w-sm text-balance">
              Five questions. One <span className="type-editorial">honest</span> answer.
            </h2>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
              Our recommendation engine weighs budget, space, usage and fuel against {cars.length} models and our expert scores.
            </p>
          </div>
          <ol className="mt-10 space-y-3">
            {QUESTIONS.map((item, i) => {
              const answered = answers[item.key];
              const current = i === step;
              const label = item.options.find((o) => o.value === answered)?.label;
              return (
                <li key={item.key} className={cn("flex items-center gap-4 text-[14px] transition-opacity duration-[400ms]", !answered && !current && "opacity-45")}>
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold num transition-colors duration-[400ms]",
                      answered ? "border-red bg-red text-white" : current ? "border-white text-white" : "border-white/30",
                    )}
                  >
                    {answered ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 truncate">
                    {item.title.replace("?", "")}
                    {label && <span className="text-white/50"> — {label}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Question / result panel */}
        <div className="border border-line bg-white lg:col-span-7 lg:border-l-0">
          <div className="h-[3px] bg-mist">
            <motion.div className="h-full bg-red" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.6, ease: EASE }} />
          </div>
          <div className="relative min-h-[520px] overflow-hidden p-6 md:p-10">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              {!done ? (
                <motion.div
                  key={`q-${step}`}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -36 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-muted num">
                      Question {step + 1} of {QUESTIONS.length}
                    </p>
                    {step === 0 ? (
                      <button type="button" onClick={sample} className="text-[13px] font-medium underline-offset-4 hover:text-red hover:underline">
                        Show me a sample result
                      </button>
                    ) : (
                      <button type="button" onClick={back} className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:text-red">
                        <ArrowLeft className="size-3.5" aria-hidden /> Back
                      </button>
                    )}
                  </div>
                  <h3 className="type-h2 mt-6">{q.title}</h3>
                  <div role="radiogroup" aria-label={q.title} className={cn("mt-8 grid grid-cols-1 gap-3", q.options.length > 3 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
                    {q.options.map((o) => {
                      const selected = answers[q.key] === o.value;
                      const Icon = o.icon;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => choose(q.key, o.value)}
                          className={cn(
                            "group relative flex min-h-[76px] items-center gap-4 border px-5 py-4 text-left transition-[border-color,background-color] duration-[250ms]",
                            selected ? "border-ink bg-ink text-white" : "border-line hover:border-ink/50 hover:bg-mist/60",
                          )}
                        >
                          {Icon && (
                            <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors", selected ? "bg-white/10" : "bg-mist group-hover:bg-white")}>
                              <Icon className="size-[18px]" aria-hidden />
                            </span>
                          )}
                          <span>
                            <span className="block text-[15px] font-medium">{o.label}</span>
                            {o.hint && <span className={cn("mt-0.5 block text-[12.5px]", selected ? "text-white/60" : "text-muted")}>{o.hint}</span>}
                          </span>
                          {selected && <Check className="absolute right-4 top-4 size-4 text-red" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
                  <Result results={results} answers={answers} onRestart={restart} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function Result({ results, answers, onRestart }: { results: { car: CarLite; match: number; reasons: string[] }[]; answers: Answers; onRestart: () => void }) {
  const { brandName } = useCatalog();
  const [best, ...alts] = results;
  if (!best) return null;
  const title = `${brandName(best.car.brand)} ${best.car.name}`;
  const params = new URLSearchParams();
  if (answers.body && answers.body !== "any") params.set("body", answers.body.toLowerCase());
  if (answers.fuel && answers.fuel !== "any") params.set("fuel", answers.fuel.toLowerCase());
  if (answers.seats === "7") params.set("seats", "7");

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="type-eyebrow text-red">Your best match</p>
        <button type="button" onClick={onRestart} className="text-[13px] font-medium underline-offset-4 hover:text-red hover:underline">
          Start again
        </button>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_1fr]">
        <Link href={`/cars/${best.car.slug}`} className="group relative block aspect-[4/3] overflow-hidden bg-mist">
          <CarImage
            car={best.car}
            alt={best.car.images[0] ? cardPhotoAlt(best.car.images[0], title) : ""}
            sizes="(min-width: 1024px) 30vw, 100vw"
            className="object-cover transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover:scale-[1.04]"
            style={{ objectPosition: best.car.focus ?? "50% 55%" }}
          />
          <span className="absolute left-3 top-3 bg-ink px-3 py-1.5 text-[12px] font-semibold text-white num">{best.match}% match</span>
        </Link>
        <div className="flex flex-col">
          <p className="text-[12px] text-muted">{brandName(best.car.brand)}</p>
          <h3 className="type-h2 mt-1">{best.car.name}</h3>
          <p className="mt-2 text-[15px] font-semibold num">{formatPriceRange(best.car.priceMin, best.car.priceMax)}</p>
          <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
            {best.reasons.map((r) => (
              <li key={r} className="flex gap-2.5 text-[14px]">
                <Check className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            <Button href={`/cars/${best.car.slug}`} size="sm" arrow>
              Explore {best.car.name}
            </Button>
            <Button href={`/new-cars${params.size ? `?${params}` : ""}`} size="sm" variant="outline">
              All matches
            </Button>
          </div>
        </div>
      </div>
      <p className="type-eyebrow mt-10 text-muted">Also worth a look</p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {alts.map(({ car, match }) => (
          <li key={car.slug}>
            <Link href={`/cars/${car.slug}`} className="group flex items-center gap-4 border border-line p-3 transition-colors hover:border-ink/40">
              <span className="relative h-14 w-20 shrink-0 overflow-hidden bg-mist">
                <CarImage car={car} alt="" sizes="80px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">
                  {brandName(car.brand)} {car.name}
                </span>
                <span className="block text-[12px] text-muted num">{match}% match</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[11.5px] text-muted">Recommendations are generated from demo data for illustration.</p>
    </div>
  );
}
