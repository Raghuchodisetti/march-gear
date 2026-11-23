"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { normaliseReg } from "@/insurance/search";
import { cn } from "@/lib/utils";
import { addGarageVehicleAction, updateGarageVehicleAction } from "@/server/actions/customer-garage";
import { useCatalog } from "@/components/providers/catalog-provider";
import { useRun } from "@/components/portal/crm/use-run";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, Label } from "@/components/ui/field";
import { StateCityFields } from "@/components/account/state-city-fields";
import { FUELS, NOT_LISTED, TRANSMISSIONS, garageHref, type GarageFormValues } from "./shared";

/* Add or edit a garage car. Brand → model → variant come from the catalogue, or "not listed" for free text. */

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="grid grid-cols-1 gap-x-8 gap-y-5 border-t border-line px-5 py-6 first:border-t-0 md:px-7 md:py-7 lg:grid-cols-[200px_minmax(0,1fr)]">
      <legend className="sr-only">{title}</legend>
      <div>
        <p aria-hidden className="text-[14px] font-semibold">
          {title}
        </p>
        {description && <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-muted lg:max-w-xs">{description}</p>}
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function VehicleForm({
  initial,
  vehicleId,
  today,
  notice,
  cancelHref,
}: {
  initial: GarageFormValues;
  /** Set when editing. */
  vehicleId?: number;
  today: string;
  /** A note above the form (e.g. "Prefilled from policy …"). */
  notice?: ReactNode;
  cancelHref: string;
}) {
  const catalog = useCatalog();
  const router = useRouter();
  const { run, busy, errors } = useRun();
  const [f, setF] = useState<GarageFormValues>(initial);
  const [done, setDone] = useState(false);
  const thisYear = Number(today.slice(0, 4));

  const brands = useMemo(() => catalog.brands.filter((b) => catalog.cars.some((c) => c.brand === b.slug)).sort((a, b) => a.name.localeCompare(b.name)), [catalog]);
  const brandListed = Boolean(f.brand) && f.brand !== NOT_LISTED;
  const models = useMemo(() => (brandListed ? catalog.cars.filter((c) => c.brand === f.brand).sort((a, b) => a.name.localeCompare(b.name)) : []), [catalog, f.brand, brandListed]);
  const car = brandListed && f.model && f.model !== NOT_LISTED ? catalog.getCar(f.model) : undefined;
  const variant = car && f.variant ? car.variants.find((v) => v.slug === f.variant) : undefined;
  const freeModel = f.brand === NOT_LISTED || (brandListed && f.model === NOT_LISTED);

  const set = (k: keyof GarageFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const digits = (k: keyof GarageFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value.replace(/[^\d]/g, "").slice(0, 7) }));

  const pickBrand = (brand: string) => setF((v) => ({ ...v, brand, model: "", variant: "", variantName: "", brandName: brand === NOT_LISTED ? v.brandName : "", modelName: brand === NOT_LISTED ? v.modelName : "" }));
  const pickModel = (model: string) =>
    setF((v) => {
      const next = model && model !== NOT_LISTED ? catalog.getCar(model) : undefined;
      // A model with one fuel or gearbox fills it in.
      const fuel = next && next.fuelTypes.length === 1 ? next.fuelTypes[0] : next && !next.fuelTypes.includes(v.fuel as never) ? "" : v.fuel;
      const transmission = next && next.transmissions.length === 1 ? next.transmissions[0] : v.transmission;
      return { ...v, model, variant: "", variantName: "", modelName: model === NOT_LISTED ? v.modelName : "", fuel, transmission };
    });
  const pickVariant = (slug: string) =>
    setF((v) => {
      const x = car?.variants.find((y) => y.slug === slug);
      return { ...v, variant: slug, fuel: x ? x.fuel : v.fuel, transmission: x ? x.transmission : v.transmission };
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...f, regNumber: normaliseReg(f.regNumber) };
    const res = vehicleId
      ? await run("save", () => updateGarageVehicleAction(vehicleId, payload), "Changes saved")
      : await run("save", () => addGarageVehicleAction(payload), "Car added to your garage");
    if (!res) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setDone(true);
    router.push(garageHref(res.id));
    router.refresh();
  };

  const years = Array.from({ length: 36 }, (_, i) => String(thisYear + 1 - i));
  const fuels = (car ? FUELS.filter((x) => car.fuelTypes.includes(x)) : FUELS).map((x) => ({ value: x, label: x }));
  const gearboxes = (car ? TRANSMISSIONS.filter((x) => car.transmissions.includes(x)) : TRANSMISSIONS).map((x) => ({ value: x, label: x }));
  const fromVariant = variant ? "From the variant you chose" : undefined;
  const saving = busy !== null || done;

  return (
    <form onSubmit={submit} noValidate className="border border-line bg-white">
      {notice && <div className="border-b border-line bg-mist/50 px-5 py-4 text-[13px] leading-relaxed md:px-7">{notice}</div>}

      <Section title="The car" description="Pick it from our catalogue for photos, reviews and better insurance estimates. Older or rarer cars: choose “Not listed”.">
        <SelectField
          id="g-brand"
          label="Brand"
          placeholder="Choose the brand"
          options={[...brands.map((b) => ({ value: b.slug, label: b.name })), { value: NOT_LISTED, label: "Not listed — type it" }]}
          value={f.brand}
          onChange={(e) => pickBrand(e.target.value)}
          error={errors.brand}
        />
        {f.brand === NOT_LISTED ? (
          <TextField id="g-brand-name" label="Brand name" value={f.brandName} onChange={set("brandName")} error={errors.brandName} maxLength={80} placeholder="e.g. Ford" autoComplete="off" />
        ) : (
          <SelectField
            id="g-model"
            label="Model"
            placeholder={brandListed ? "Choose the model" : "Choose a brand first"}
            disabled={!brandListed}
            options={[...models.map((m) => ({ value: m.slug, label: m.name })), ...(brandListed ? [{ value: NOT_LISTED, label: "Not listed — type it" }] : [])]}
            value={f.model}
            onChange={(e) => pickModel(e.target.value)}
            error={errors.model}
          />
        )}
        {freeModel && (
          <>
            <TextField id="g-model-name" label="Model name" value={f.modelName} onChange={set("modelName")} error={errors.modelName} maxLength={120} placeholder="e.g. EcoSport" autoComplete="off" />
            <TextField id="g-variant-name" label="Variant (optional)" value={f.variantName} onChange={set("variantName")} error={errors.variantName} maxLength={120} placeholder="e.g. Titanium 1.5" autoComplete="off" />
          </>
        )}
        {!freeModel && (
          <SelectField
            id="g-variant"
            label="Variant (optional)"
            placeholder={car ? "Not sure" : "Choose a model first"}
            disabled={!car}
            options={(car?.variants ?? []).map((v) => ({ value: v.slug, label: `${v.name} · ${v.fuel} · ${v.transmission}` }))}
            value={f.variant}
            onChange={(e) => pickVariant(e.target.value)}
            error={errors.variant}
          />
        )}
        <SelectField id="g-year" label="Manufacturing year" placeholder="Choose the year" options={years.map((y) => ({ value: y, label: y }))} value={f.year} onChange={set("year")} error={errors.year} />
        <SelectField id="g-fuel" label="Fuel" placeholder="Choose the fuel" options={fuels} value={f.fuel} onChange={set("fuel")} error={errors.fuel} disabled={Boolean(variant)} />
        <div>
          <SelectField id="g-gearbox" label="Gearbox" placeholder="Choose the gearbox" options={gearboxes} value={f.transmission} onChange={set("transmission")} error={errors.transmission} disabled={Boolean(variant)} />
          {fromVariant && <p className="mt-1.5 text-xs text-muted">{fromVariant}</p>}
        </div>
        <TextField id="g-nickname" label="Nickname (optional)" value={f.nickname} onChange={set("nickname")} error={errors.nickname} maxLength={60} placeholder="e.g. The family car" autoComplete="off" />
      </Section>

      <Section title="Registration & ownership" description="Used to prefill insurance quotes. Your registration number stays private to your account.">
        <TextField
          id="g-reg"
          label="Registration number (optional)"
          value={f.regNumber}
          onChange={(e) => setF((v) => ({ ...v, regNumber: e.target.value.toUpperCase().slice(0, 16) }))}
          error={errors.regNumber}
          placeholder="MH12AB1234"
          autoComplete="off"
        />
        <TextField
          id="g-odometer"
          label="Odometer (km, optional)"
          inputMode="numeric"
          value={f.odometerKm}
          onChange={digits("odometerKm")}
          error={errors.odometerKm}
          placeholder="e.g. 24500"
        />
        <div className="sm:col-span-2">
          <StateCityFields idPrefix="g" state={f.state} city={f.city} onState={(state) => setF((v) => ({ ...v, state }))} onCity={(city) => setF((v) => ({ ...v, city }))} errors={{ state: errors.state, city: errors.city }} priceHint={false} />
        </div>
        <TextField
          id="g-purchased"
          type="date"
          label="Purchase or delivery date (optional)"
          value={f.purchasedOn}
          onChange={set("purchasedOn")}
          error={errors.purchasedOn}
          hint={f.purchasedOn && f.purchasedOn > today ? "Not delivered yet — we'll suggest a PDI check." : undefined}
        />
      </Section>

      <Section title="Insurance" description="Add the policy expiry to get renewal reminders and prefilled renewal quotes.">
        <TextField id="g-insurer" label="Insurer (optional)" value={f.insurer} onChange={set("insurer")} error={errors.insurer} maxLength={160} placeholder="Your insurance company" autoComplete="off" />
        <TextField id="g-policy" label="Policy number (optional)" value={f.policyNumber} onChange={set("policyNumber")} error={errors.policyNumber} maxLength={60} autoComplete="off" />
        <TextField id="g-ins-expiry" type="date" label="Policy expiry (optional)" value={f.insuranceExpiry} onChange={set("insuranceExpiry")} error={errors.insuranceExpiry} />
      </Section>

      <Section title="Upkeep" description="Reminders start 30 days before PUC and service dates, and 60 days before the warranty ends.">
        <TextField id="g-puc" type="date" label="PUC certificate valid until (optional)" value={f.pucExpiry} onChange={set("pucExpiry")} error={errors.pucExpiry} />
        <TextField id="g-warranty" type="date" label="Warranty ends (optional)" value={f.warrantyUntil} onChange={set("warrantyUntil")} error={errors.warrantyUntil} />
        <TextField id="g-service" type="date" label="Next service date (optional)" value={f.serviceDueOn} onChange={set("serviceDueOn")} error={errors.serviceDueOn} />
        <TextField id="g-service-km" label="Next service at (km, optional)" inputMode="numeric" value={f.serviceDueKm} onChange={digits("serviceDueKm")} error={errors.serviceDueKm} placeholder="e.g. 30000" />
      </Section>

      <Section title="Notes" description="Anything you want to remember — tyre sizes, the service advisor's name.">
        <div className="sm:col-span-2">
          <Label htmlFor="g-notes" className="sr-only">
            Notes
          </Label>
          <textarea
            id="g-notes"
            value={f.notes}
            onChange={set("notes")}
            maxLength={500}
            rows={3}
            aria-invalid={errors.notes ? true : undefined}
            placeholder="Optional"
            className={cn(
              "min-h-24 w-full rounded-[3px] border border-line bg-white px-4 py-3 text-[15px] leading-relaxed text-ink outline-none transition-[border-color] duration-[250ms] placeholder:text-muted/70 hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red",
            )}
          />
          <p className={cn("mt-1.5 text-xs", errors.notes ? "text-red" : "text-muted")}>{errors.notes ?? `${f.notes.length}/500`}</p>
        </div>
      </Section>

      <div className="flex flex-col-reverse gap-2 border-t border-line bg-mist/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
        <p className="text-[12px] text-muted">Reminders use the dates you enter. They show in your account and notifications — we don&apos;t send SMS or email reminders.</p>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
          <Button href={cancelHref} variant="ghost" size="sm" className={cn(saving && "pointer-events-none opacity-40")}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" size="sm" disabled={saving} icon={saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}>
            {vehicleId ? "Save changes" : "Add to my garage"}
          </Button>
        </div>
      </div>
    </form>
  );
}
