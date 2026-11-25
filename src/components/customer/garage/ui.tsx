import Image from "next/image";
import { cardPhotoAlt } from "@/lib/image-alt";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BadgeCheck, CarFront, ClipboardCheck, IndianRupee, ShieldCheck, Star, Tag, Wind, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/portal/ui";
import { daysBetween } from "@/components/portal/billing/shared";
import {
  REMINDER_KIND_LABEL,
  carName,
  carSpecLine,
  carTitle,
  dateStatus,
  editHref,
  formatReg,
  garageHref,
  relativeDays,
  type GarageCar,
  type GarageReminder,
  type QuickAction,
  type QuickActionKey,
  type ReminderKind,
} from "./shared";

/* Server-safe pieces of My garage: the car visual, number plate, cards, reminder lists and quick actions. */

export type CarImage = { src: string; focus?: string } | null;

export const REMINDER_ICON: Record<ReminderKind, LucideIcon> = { insurance: ShieldCheck, puc: Wind, service: Wrench, warranty: BadgeCheck };
const ACTION_ICON: Record<QuickActionKey, LucideIcon> = { quotes: ShieldCheck, value: IndianRupee, sell: Tag, pdi: ClipboardCheck, reviews: Star };

const DOT: Record<string, string> = {
  red: "bg-red",
  amber: "bg-[#e09200]",
  blue: "bg-[#2456a6]",
  green: "bg-[#22a04f]",
  neutral: "bg-ink/25",
  dark: "bg-ink",
};

/** The catalogue photo, or a quiet placeholder with the car's name when we don't have one. */
export function CarVisual({ car, image, sizes, className, priority }: { car: Pick<GarageCar, "brandName" | "modelName">; image: CarImage; sizes: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-[#1b1b1b]", className)}>
      {image ? (
        <Image src={image.src} alt={cardPhotoAlt(image.src, carTitle(car))} fill sizes={sizes} preload={priority} className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/card:scale-[1.03]" style={{ objectPosition: image.focus ?? "50% 55%" }} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
          <span aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_22px,rgba(255,255,255,0.025)_22px_23px)]" />
          <span aria-hidden className="absolute left-5 top-5 h-px w-8 bg-red" />
          <CarFront aria-hidden strokeWidth={1.1} className="relative size-14 text-white/25" />
          <span className="relative text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
            <span className="sr-only">{carTitle(car)} — </span>No catalogue photo
          </span>
        </div>
      )}
    </div>
  );
}

/** An Indian number plate. */
export function RegPlate({ reg, className }: { reg: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-[2px] border border-ink/70 bg-white px-1.5 font-mono text-[11.5px] font-semibold tracking-[0.08em] text-ink", className)}>
      <span aria-hidden className="mr-1.5 h-3.5 w-[3px] rounded-[1px] bg-[#2456a6]" />
      {formatReg(reg)}
    </span>
  );
}

const DATE_ROWS: { kind: ReminderKind; key: "insuranceExpiry" | "pucExpiry" | "serviceDueOn" | "warrantyUntil"; short: string }[] = [
  { kind: "insurance", key: "insuranceExpiry", short: "Insurance" },
  { kind: "puc", key: "pucExpiry", short: "PUC" },
  { kind: "service", key: "serviceDueOn", short: "Service" },
  { kind: "warranty", key: "warrantyUntil", short: "Warranty" },
];

/** A car in the garage list. The name is a stretched link; the quotes link stays separate. */
export function VehicleCard({ car, image, today, insuranceWindow, quotesHref, notDelivered }: { car: GarageCar; image: CarImage; today: string; insuranceWindow: number; quotesHref: string; notDelivered: boolean }) {
  const name = carName(car);
  const spec = carSpecLine(car);
  return (
    <article className="group/card relative flex flex-col border border-line bg-white transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/25">
      <div className="relative">
        <CarVisual car={car} image={image} sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw" className="aspect-[16/9]" />
        {notDelivered && (
          <div className="absolute left-3 top-3">
            <Badge tone="dark">Awaiting delivery</Badge>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{car.nickname ? carTitle(car) : car.brandName}</p>
            <h3 className="mt-1 truncate font-display text-[19px] font-semibold leading-tight tracking-[-0.02em]">
              <Link href={garageHref(car.id)} className="after:absolute after:inset-0 stretched-focus">
                {car.nickname ? name : car.modelName}
              </Link>
            </h3>
            <p className="mt-1 truncate text-[12.5px] text-muted">{spec || "Add the year, fuel and gearbox"}</p>
          </div>
          {car.regNumber && <RegPlate reg={car.regNumber} className="mt-0.5 shrink-0" />}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-line bg-line text-[12.5px]">
          {DATE_ROWS.map((r) => {
            const due = car[r.key];
            const s = dateStatus(r.kind, due, today, insuranceWindow);
            return (
              <div key={r.kind} className="min-w-0 bg-white px-3 py-2.5">
                <dt className="flex items-center justify-between gap-2 text-muted">
                  {r.short}
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink/75">
                    <span aria-hidden className={cn("size-1.5 rounded-full", DOT[s.tone])} />
                    {s.text}
                  </span>
                </dt>
                <dd className={cn("mt-1 truncate font-medium num", !due && "font-normal text-muted")}>{due ? formatDate(due) : "—"}</dd>
              </div>
            );
          })}
        </dl>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <Link href={quotesHref} className="relative z-10 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 hover:underline">
            <ShieldCheck aria-hidden className="size-4 text-red" />
            {notDelivered ? "New-car insurance quotes" : "Renewal quotes"}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
            Manage
            <ArrowRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover/card:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

/** Due reminders as a list. `showCar` adds the car's name (the garage-wide list). */
export function ReminderList({ reminders, showCar = true, highlight }: { reminders: GarageReminder[]; showCar?: boolean; highlight?: string }) {
  return (
    <ul className="divide-y divide-line">
      {reminders.map((r) => {
        const Icon = REMINDER_ICON[r.kind];
        const key = `${r.vehicleId}-${r.kind}-${r.dueOn}`;
        const on = highlight === `${r.kind}-${r.dueOn}`;
        return (
          <li key={key} className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 gap-y-2 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center", on && "bg-[#fff8f8] shadow-[inset_3px_0_0_var(--color-red)]")}>
            <span className={cn("mt-0.5 inline-flex size-9 items-center justify-center rounded-[3px] sm:mt-0", r.tone === "red" ? "bg-red-50 text-red" : r.tone === "amber" ? "bg-[#fdf3e1] text-[#9a5b00]" : "bg-mist text-ink/70")}>
              <Icon aria-hidden className="size-[18px]" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium">{r.label}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {showCar && (
                  <>
                    <Link href={garageHref(r.vehicleId)} className="text-ink/80 hover:text-red">
                      {r.vehicle}
                    </Link>
                    {" · "}
                  </>
                )}
                {REMINDER_KIND_LABEL[r.kind]} date {formatDate(r.dueOn)}
              </p>
            </div>
            {r.action && (
              <Link
                href={r.action.href}
                className="col-start-2 inline-flex h-8 items-center gap-1.5 justify-self-start rounded-[3px] border border-line bg-white px-3 text-[12.5px] font-medium transition-colors hover:border-ink sm:col-start-3 sm:justify-self-end"
              >
                {r.action.label}
                <ArrowUpRight aria-hidden className="size-3.5 text-red" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The four dates on the car page, each with its status and what to do. */
export function DateRows({ car, today, insuranceWindow, reminders, highlight }: { car: GarageCar; today: string; insuranceWindow: number; reminders: GarageReminder[]; highlight?: string }) {
  const extra: Record<ReminderKind, ReactNode> = {
    insurance: car.insurer || car.policyNumber ? [car.insurer, car.policyNumber && `Policy ${car.policyNumber}`].filter(Boolean).join(" · ") : null,
    puc: null,
    service: car.serviceDueKm ? `or at ${car.serviceDueKm.toLocaleString("en-IN")} km${car.odometerKm ? ` (now ${car.odometerKm.toLocaleString("en-IN")} km)` : ""}` : null,
    warranty: null,
  };
  return (
    <ul className="divide-y divide-line">
      {DATE_ROWS.map((r) => {
        const due = car[r.key];
        const s = dateStatus(r.kind, due, today, insuranceWindow);
        const Icon = REMINDER_ICON[r.kind];
        const reminder = reminders.find((x) => x.kind === r.kind);
        const on = Boolean(reminder && highlight === `${reminder.kind}-${reminder.dueOn}`);
        const n = due ? daysBetween(today, due) : null;
        return (
          <li key={r.kind} id={`date-${r.kind}`} className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center", on && "bg-[#fff8f8] shadow-[inset_3px_0_0_var(--color-red)]")}>
            <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-[3px] bg-mist text-ink/70 sm:mt-0">
              <Icon aria-hidden className="size-[18px]" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px] font-medium">
                {REMINDER_KIND_LABEL[r.kind]}
                <Badge tone={s.tone}>{s.text}</Badge>
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                {due ? (
                  <>
                    <span className="text-ink/80 num">{formatDate(due)}</span>
                    {n !== null && ` · ${relativeDays(n)}`}
                  </>
                ) : (
                  "No date added"
                )}
                {extra[r.kind] && <span className="block sm:inline">{due ? " · " : " "}{extra[r.kind]}</span>}
              </p>
            </div>
            {reminder?.action ? (
              <Link href={reminder.action.href} className="col-start-2 inline-flex h-8 items-center gap-1.5 justify-self-start rounded-[3px] border border-line bg-white px-3 text-[12.5px] font-medium transition-colors hover:border-ink sm:col-start-3 sm:justify-self-end">
                {reminder.action.label}
                <ArrowUpRight aria-hidden className="size-3.5 text-red" />
              </Link>
            ) : !due ? (
              <Link href={editHref(car.id)} className="col-start-2 text-[12.5px] font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:col-start-3 sm:justify-self-end">
                Add date
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** "Get renewal quotes", "Check its value"… as a list of rows. */
export function QuickActionList({ actions }: { actions: QuickAction[] }) {
  return (
    <ul className="divide-y divide-line">
      {actions.map((a) => {
        const Icon = ACTION_ICON[a.key];
        return (
          <li key={a.key}>
            <Link href={a.href} className="group/qa flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-mist/50">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] border border-line bg-white text-ink/80 transition-colors group-hover/qa:border-ink/30">
                <Icon aria-hidden className="size-[17px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{a.label}</span>
                <span className="block text-[12px] leading-snug text-muted">{a.description}</span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-red transition-transform duration-[250ms] group-hover/qa:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Key facts about a car, for the detail page. */
export function CarFacts({ car, notDelivered }: { car: GarageCar; notDelivered: boolean }) {
  const rows: [string, ReactNode][] = [
    ["Variant", car.variantName],
    ["Year", car.year],
    ["Fuel", car.fuel],
    ["Gearbox", car.transmission],
    ["Registration", car.regNumber ? <RegPlate key="r" reg={car.regNumber} /> : null],
    ["Registered in", [car.city, car.state].filter(Boolean).join(", ")],
    [notDelivered ? "Delivery" : "Bought", car.purchasedOn ? formatDate(car.purchasedOn) : null],
    ["Odometer", car.odometerKm !== null ? `${car.odometerKm.toLocaleString("en-IN")} km` : null],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px bg-line">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0 bg-white px-4 py-3">
          <dt className="text-[11.5px] text-muted">{k}</dt>
          <dd className="mt-1 min-h-6 truncate text-[13.5px] font-medium num">{v === null || v === undefined || v === "" ? <span className="font-normal text-muted">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

