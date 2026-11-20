"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Sheet } from "lucide-react";
import type { ActionFailure } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { analyticsExportAction } from "@/server/actions/partner-analytics";
import { useUI } from "@/components/providers/app-provider";
import { Segmented } from "@/components/ui/field";
import { istDate } from "@/components/portal/billing/shared";
import { MAX_RANGE_DAYS, type DateRange, type RangePreset } from "./report";

const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Please try again." };
const input = "h-10 rounded-[3px] border border-line bg-white px-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink";

export function AnalyticsToolbar({ range, compare }: { range: DateRange; compare: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useUI();
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState<RangePreset>(range.preset);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const today = istDate();

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const go = (q: Record<string, string>, cmp = compare) => {
    const params = new URLSearchParams(q);
    if (!cmp) params.set("compare", "0");
    start(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  const pickPreset = (p: RangePreset) => {
    setPreset(p);
    if (p !== "custom") go({ range: p });
  };

  const exportAs = async (format: "csv" | "excel" | "pdf") => {
    setMenu(false);
    setBusy(format);
    const res = await analyticsExportAction({ range: range.preset, from: range.from, to: range.to, format }).catch(() => OFFLINE);
    if (!res.ok) {
      setBusy(null);
      return toast(res.error ?? "Couldn't export the report", { tone: "error" });
    }
    try {
      const mod = await import("./export");
      if (format === "pdf") await mod.downloadPdf(res.report, compare);
      else mod.downloadCsv(res.report, compare, format === "excel");
      toast(format === "pdf" ? "PDF report downloaded" : format === "excel" ? "Excel-ready CSV downloaded" : "CSV downloaded", { tone: "success" });
    } catch (err) {
      console.error(err);
      toast("Couldn't build the file. Please try again.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const query: Record<string, string> = range.preset === "custom" ? { range: "custom", from: range.from, to: range.to } : { range: range.preset };
  const customInvalid = !from || !to || from > to || to > today;

  return (
    <div className="mb-6 border border-line bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Segmented
            ariaLabel="Date range"
            className="w-full sm:w-auto"
            value={preset}
            onChange={pickPreset}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13px] font-medium">
            <span className="relative inline-flex">
              <input type="checkbox" className="peer sr-only" checked={compare} onChange={(e) => go(query, e.target.checked)} />
              <span className="h-5 w-9 rounded-full bg-[#DADADA] transition-colors duration-300 peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30" />
              <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-300 peer-checked:translate-x-4" />
            </span>
            Compare to previous period
          </label>
          {pending && <Loader2 className="size-4 animate-spin text-muted" aria-label="Loading" />}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            disabled={busy !== null}
            aria-expanded={menu}
            aria-haspopup="menu"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 disabled:opacity-50 sm:w-auto"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />} Export
            <ChevronDown className={cn("size-3.5 transition-transform duration-300", menu && "rotate-180")} aria-hidden />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 z-20 mt-2 w-[280px] max-w-[calc(100vw-2rem)] border border-line bg-white p-1.5 shadow-lift">
              {(
                [
                  ["pdf", FileText, "PDF report", "Branded report of this view"],
                  ["excel", FileSpreadsheet, "Excel (.csv)", "CSV with a UTF-8 marker so Excel opens it cleanly — not an .xlsx file"],
                  ["csv", Sheet, "CSV", "Plain comma-separated values"],
                ] as const
              ).map(([f, Icon, t, d]) => (
                <button key={f} type="button" role="menuitem" onClick={() => exportAs(f)} className="flex w-full gap-3 rounded-[3px] px-3 py-2.5 text-left transition-colors hover:bg-[#F6F6F6]">
                  <Icon className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                  <span>
                    <span className="block text-[13.5px] font-medium">{t}</span>
                    <span className="block text-[12px] leading-snug text-muted">{d}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {preset === "custom" && (
        <form
          className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!customInvalid) go({ range: "custom", from, to });
          }}
        >
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            From
            <input type="date" className={input} value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            To
            <input type="date" className={input} value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="submit" disabled={customInvalid || pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-[3px] border border-ink px-4 text-[13px] font-medium transition-colors hover:bg-ink hover:text-white disabled:opacity-40">
            <CalendarRange className="size-4" aria-hidden /> Apply range
          </button>
          <p className="text-[12px] text-muted sm:ml-2 sm:self-center">Up to {MAX_RANGE_DAYS} days · dates in IST</p>
        </form>
      )}
    </div>
  );
}
