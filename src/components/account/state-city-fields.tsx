"use client";

import { useState } from "react";
import { INDIA_CITIES } from "@/data/india-cities";
import { INDIAN_STATES, isIndianState } from "@/data/states";
import { SelectField, TextField } from "@/components/ui/field";
import { useCatalog } from "@/components/providers/catalog-provider";

const OTHER = "__other";

/**
 * State (all Indian states & UTs) → city (that state's district headquarters and major cities,
 * plus "Other city…" for anywhere not listed). Used on sign-up and the profile page.
 */
export function StateCityFields({
  state,
  city,
  onState,
  onCity,
  errors = {},
  idPrefix,
  priceHint = true,
}: {
  state: string;
  city: string;
  onState: (v: string) => void;
  onCity: (v: string) => void;
  errors?: { state?: string; city?: string };
  idPrefix: string;
  /** The "On-road prices are available for …" note under the city — off where car prices don't apply (e.g. insurer branches). */
  priceHint?: boolean;
}) {
  const { cities: covered } = useCatalog();

  // The state's cities, plus any city we price on-road there (in case the two lists spell it differently).
  const listFor = (s: string) =>
    isIndianState(s) ? [...new Set([...INDIA_CITIES[s], ...covered.filter((c) => c.state === s).map((c) => c.name)])].sort((a, b) => a.localeCompare(b)) : [];
  const list = listFor(state);
  // "Other" when the saved city isn't in the state's list (e.g. a smaller town).
  const [other, setOther] = useState(() => Boolean(city) && !listFor(state).includes(city));
  const pricedHere = covered.filter((c) => c.state === state);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <SelectField
        id={`${idPrefix}-state`}
        label="State"
        placeholder="Choose your state"
        options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
        value={state}
        onChange={(e) => {
          const next = e.target.value;
          onState(next);
          // Keep the city only if it also exists in the new state.
          if (city && !listFor(next).includes(city)) onCity("");
          setOther(false);
        }}
        error={errors.state}
        autoComplete="address-level1"
      />
      <div>
        <SelectField
          id={`${idPrefix}-city`}
          label="City"
          placeholder={state ? "Choose your city" : "Choose a state first"}
          disabled={!state}
          options={[...list.map((c) => ({ value: c, label: c })), ...(state ? [{ value: OTHER, label: "Other city or town…" }] : [])]}
          value={other ? OTHER : list.includes(city) ? city : ""}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setOther(true);
              onCity("");
            } else {
              setOther(false);
              onCity(e.target.value);
            }
          }}
          error={other ? undefined : errors.city}
          autoComplete="address-level2"
        />
        {other && (
          <TextField
            id={`${idPrefix}-city-other`}
            className="mt-3"
            label="Your city or town"
            value={city}
            onChange={(e) => onCity(e.target.value)}
            placeholder="Type your city or town"
            error={errors.city}
            autoFocus
          />
        )}
        {priceHint && !errors.city && pricedHere.length > 0 && (
          <p className="mt-1.5 text-xs text-muted">On-road prices are available for {pricedHere.map((c) => c.name).join(", ")}.</p>
        )}
      </div>
    </div>
  );
}
