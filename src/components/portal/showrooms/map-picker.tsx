"use client";

import { useState } from "react";
import { Crosshair, ExternalLink, Loader2, MapPin, Search, X } from "lucide-react";
import { useUI } from "@/components/providers/app-provider";
import { inputCls } from "@/components/portal/profile/kit";
import { osmEmbed, osmLink } from "./shared";

/**
 * Pin a showroom on the map: the browser's real location, an address lookup on OpenStreetMap
 * (Nominatim), or coordinates typed/pasted from any map app. Preview via the OSM embed.
 */
export function MapPicker({
  lat,
  lng,
  onChange,
  address,
  error,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  address: string;
  error?: string;
}) {
  const { toast } = useUI();
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [latText, setLatText] = useState(lat?.toString() ?? "");
  const [lngText, setLngText] = useState(lng?.toString() ?? "");
  const [last, setLast] = useState({ lat, lng });
  // Keep the text boxes in step when the point changes from a button.
  if (last.lat !== lat || last.lng !== lng) {
    setLast({ lat, lng });
    setLatText(lat?.toString() ?? "");
    setLngText(lng?.toString() ?? "");
  }

  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  const set = (a: number | null, b: number | null) => onChange(a === null ? null : round(a), b === null ? null : round(b));

  const locate = () => {
    if (!("geolocation" in navigator)) return toast("This browser can't share its location. Enter the coordinates instead.", { tone: "error" });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        set(pos.coords.latitude, pos.coords.longitude);
        toast(`Location set (accurate to about ${Math.max(1, Math.round(pos.coords.accuracy))} m). Check the pin before saving.`, { tone: "success" });
      },
      (err) => {
        setLocating(false);
        toast(err.code === err.PERMISSION_DENIED ? "Location permission was denied. Allow it in your browser, or enter the coordinates." : "Couldn't get your location. Enter the coordinates instead.", { tone: "error" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const lookup = async () => {
    if (address.trim().length < 6) return toast("Fill in the address, city and PIN code first.", { tone: "error" });
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(address)}`, { headers: { Accept: "application/json" } });
      const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (!hits.length) toast("OpenStreetMap couldn't find that address. Try the PIN code and city only, or use your location.", { tone: "error" });
      else {
        set(Number(hits[0].lat), Number(hits[0].lon));
        toast("Found on the map — check the pin, and paste exact coordinates if it is off.", { tone: "success" });
      }
    } catch {
      toast("Couldn't reach OpenStreetMap. Check your connection or enter the coordinates.", { tone: "error" });
    } finally {
      setSearching(false);
    }
  };

  /** Accepts "12.97, 77.64" pasted from a map app into either box. */
  const typed = (which: "lat" | "lng", text: string) => {
    const pair = text.match(/(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/);
    if (pair) return set(Number(pair[1]), Number(pair[2]));
    if (which === "lat") setLatText(text);
    else setLngText(text);
    const a = Number(which === "lat" ? text : latText);
    const b = Number(which === "lng" ? text : lngText);
    const okA = (which === "lat" ? text : latText).trim() !== "" && Number.isFinite(a);
    const okB = (which === "lng" ? text : lngText).trim() !== "" && Number.isFinite(b);
    if (okA && okB) {
      setLast({ lat: round(a), lng: round(b) });
      onChange(round(a), round(b));
    } else if (!text.trim()) onChange(which === "lat" ? null : lat, which === "lng" ? null : lng);
  };

  const has = lat !== null && lng !== null;
  return (
    <div>
      <div className="relative aspect-[16/9] overflow-hidden border border-line bg-mist">
        {has ? (
          <iframe key={`${lat},${lng}`} title="Showroom location map" src={osmEmbed(lat, lng)} className="size-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
            <MapPin aria-hidden className="size-6 text-muted" />
            <p className="text-[13px] text-muted">No location yet. Use your current location at the showroom, look up the address, or paste coordinates.</p>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={locate} disabled={locating} className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line bg-white px-3 text-[13px] font-medium transition-colors hover:border-ink disabled:opacity-50">
          {locating ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Crosshair aria-hidden className="size-4" />} Use my location
        </button>
        <button type="button" onClick={lookup} disabled={searching} className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line bg-white px-3 text-[13px] font-medium transition-colors hover:border-ink disabled:opacity-50">
          {searching ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Search aria-hidden className="size-4" />} Find address
        </button>
        {has && (
          <>
            <a href={osmLink(lat, lng)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 px-2 text-[13px] font-medium text-muted hover:text-ink">
              <ExternalLink aria-hidden className="size-4" /> Open map
            </a>
            <button type="button" onClick={() => set(null, null)} className="inline-flex h-9 items-center gap-1.5 px-2 text-[13px] font-medium text-muted hover:text-red">
              <X aria-hidden className="size-4" /> Clear
            </button>
          </>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="sr-lat" className="mb-1.5 block text-[12px] font-medium">
            Latitude
          </label>
          <input id="sr-lat" value={latText} onChange={(e) => typed("lat", e.target.value)} inputMode="decimal" placeholder="12.971599" className={inputCls} aria-invalid={Boolean(error) || undefined} />
        </div>
        <div>
          <label htmlFor="sr-lng" className="mb-1.5 block text-[12px] font-medium">
            Longitude
          </label>
          <input id="sr-lng" value={lngText} onChange={(e) => typed("lng", e.target.value)} inputMode="decimal" placeholder="77.594566" className={inputCls} aria-invalid={Boolean(error) || undefined} />
        </div>
      </div>
      {error ? <p className="mt-1.5 text-xs text-red">{error}</p> : <p className="mt-1.5 text-xs text-muted">Tip: paste &ldquo;12.97, 77.59&rdquo; from Google Maps into either box.</p>}
    </div>
  );
}
