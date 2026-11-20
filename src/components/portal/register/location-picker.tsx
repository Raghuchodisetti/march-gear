"use client";

import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, ExternalLink, Loader2, LocateFixed, MapPin, Minus, Plus, X } from "lucide-react";
import { CITY_COORDS } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { FieldError } from "./controls";

/* ──────────────────────────────────────────────────────────────
   Showroom location: an embedded OpenStreetMap view with the pin,
   the browser's real geolocation, an approximate city centre
   (offline table), editable coordinates and fine-tuning nudges.
   ────────────────────────────────────────────────────────────── */

const ZOOMS = [0.0025, 0.005, 0.012, 0.03, 0.08];
const round = (v: number) => Math.round(v * 1e6) / 1e6;

function embedUrl(lat: number, lng: number, d: number) {
  const bbox = [lng - d * 1.6, lat - d, lng + d * 1.6, lat + d].map((v) => v.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

const GEO_ERRORS: Record<number, string> = {
  1: "Location access was blocked. Allow it in your browser's site settings, or enter the coordinates below.",
  2: "Your location isn't available right now. Enter the coordinates below instead.",
  3: "Finding your location took too long. Try again, or enter the coordinates below.",
};

export function LocationPicker({ lat, lng, city, onChange, error }: { lat: number | null; lng: number | null; city: string; onChange: (lat: number | null, lng: number | null) => void; error?: string }) {
  const [zoom, setZoom] = useState(1);
  const [locating, setLocating] = useState(false);
  const [geoNote, setGeoNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [draft, setDraft] = useState<{ lat: string; lng: string } | null>(null);

  const has = lat !== null && lng !== null;
  const cityKey = Object.keys(CITY_COORDS).find((c) => c.toLowerCase() === city.trim().toLowerCase());
  const shownLat = draft?.lat ?? (lat === null ? "" : String(lat));
  const shownLng = draft?.lng ?? (lng === null ? "" : String(lng));

  const commit = (la: string, ln: string) => {
    const a = la.trim() === "" ? null : Number(la);
    const b = ln.trim() === "" ? null : Number(ln);
    if ((a !== null && !Number.isFinite(a)) || (b !== null && !Number.isFinite(b))) return;
    onChange(a === null ? null : round(a), b === null ? null : round(b));
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoNote({ tone: "error", text: "This browser can't share its location. Enter the coordinates below." });
      return;
    }
    setLocating(true);
    setGeoNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setDraft(null);
        setZoom(0);
        onChange(round(pos.coords.latitude), round(pos.coords.longitude));
        setGeoNote({ tone: "ok", text: `Pinned to your current location (accurate to about ${Math.max(1, Math.round(pos.coords.accuracy))} m). Make sure you're at the showroom, or fine-tune the pin.` });
      },
      (err) => {
        setLocating(false);
        setGeoNote({ tone: "error", text: GEO_ERRORS[err.code] ?? "We couldn't get your location." });
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const nudge = (dLat: number, dLng: number) => {
    if (!has) return;
    const step = ZOOMS[zoom] / 6;
    setDraft(null);
    onChange(round(lat! + dLat * step), round(lng! + dLng * step));
  };

  const btn = "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[3px] border border-line bg-white px-3 text-[12.5px] font-medium transition-colors duration-300 hover:border-ink disabled:opacity-40";
  const pad = "inline-flex size-8 items-center justify-center rounded-full bg-white/95 text-ink shadow-soft transition-colors hover:bg-ink hover:text-white";

  return (
    <div data-error={error ? "true" : undefined}>
      <p className="mb-2 text-[12.5px] font-medium text-ink">
        Location on map <span className="font-normal text-muted">(recommended)</span>
      </p>
      <div className={cn("relative overflow-hidden border bg-mist", error ? "border-red" : "border-line")}>
        {has ? (
          <iframe
            key={`${lat},${lng},${zoom}`}
            title="Showroom location map"
            src={embedUrl(lat!, lng!, ZOOMS[zoom])}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block h-[260px] w-full border-0 md:h-[300px]"
          />
        ) : (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 px-6 text-center md:h-[240px]">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-white text-muted shadow-soft">
              <MapPin aria-hidden className="size-5" />
            </span>
            <p className="text-[13.5px] font-medium">No location pinned yet</p>
            <p className="max-w-sm text-[12.5px] text-muted">Use your current location if you&apos;re at the showroom, start from the city centre, or paste coordinates from any map app.</p>
          </div>
        )}
        {has && (
          <>
            <div className="absolute right-3 top-3 flex flex-col gap-1.5">
              <button type="button" className={pad} onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Zoom in">
                <Plus className="size-4" />
              </button>
              <button type="button" className={pad} onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom out">
                <Minus className="size-4" />
              </button>
            </div>
            <div className="absolute left-3 top-3 grid grid-cols-3 gap-1" aria-label="Move the pin">
              <span />
              <button type="button" className={pad} onClick={() => nudge(1, 0)} aria-label="Move pin north">
                <ArrowUp className="size-4" />
              </button>
              <span />
              <button type="button" className={pad} onClick={() => nudge(0, -1)} aria-label="Move pin west">
                <ArrowLeft className="size-4" />
              </button>
              <span className="inline-flex size-8 items-center justify-center text-red" aria-hidden>
                <Crosshair className="size-4" />
              </span>
              <button type="button" className={pad} onClick={() => nudge(0, 1)} aria-label="Move pin east">
                <ArrowRight className="size-4" />
              </button>
              <span />
              <button type="button" className={pad} onClick={() => nudge(-1, 0)} aria-label="Move pin south">
                <ArrowDown className="size-4" />
              </button>
              <span />
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={locate} disabled={locating} className={btn}>
          {locating ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <LocateFixed aria-hidden className="size-4" />}
          {locating ? "Finding you…" : "Use my location"}
        </button>
        {cityKey && (
          <button
            type="button"
            className={btn}
            onClick={() => {
              const [a, b] = CITY_COORDS[cityKey];
              setDraft(null);
              setZoom(3);
              onChange(a, b);
              setGeoNote({ tone: "ok", text: `Centred on ${cityKey} — this is only the city centre. Zoom in and move the pin onto your showroom.` });
            }}
          >
            <MapPin aria-hidden className="size-4" /> Start from {cityKey}
          </button>
        )}
        {has && (
          <a className={btn} href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden className="size-4" /> Check on OpenStreetMap
          </a>
        )}
        {has && (
          <button
            type="button"
            className={cn(btn, "text-muted")}
            onClick={() => {
              setDraft(null);
              setGeoNote(null);
              onChange(null, null);
            }}
          >
            <X aria-hidden className="size-4" /> Clear
          </button>
        )}
      </div>
      {geoNote && <p className={cn("mt-2 text-[12.5px]", geoNote.tone === "error" ? "text-red" : "text-muted")}>{geoNote.text}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
        {(["lat", "lng"] as const).map((k) => (
          <label key={k} className="block">
            <span className="mb-1.5 block text-[12px] text-muted">{k === "lat" ? "Latitude" : "Longitude"}</span>
            <input
              inputMode="decimal"
              value={k === "lat" ? shownLat : shownLng}
              placeholder={k === "lat" ? "17.686800" : "83.218500"}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.-]/g, "");
                const next = { lat: k === "lat" ? v : shownLat, lng: k === "lng" ? v : shownLng };
                setDraft(next);
                commit(next.lat, next.lng);
              }}
              onBlur={() => setDraft(null)}
              className="h-10 w-full rounded-[3px] border border-line bg-white px-3 font-mono text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red"
            />
          </label>
        ))}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}
