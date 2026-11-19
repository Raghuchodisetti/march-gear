"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { CalendarCheck, HandCoins, Loader2, MessageSquare, Share2 } from "lucide-react";
import type { UsedCar } from "@/types";
import { formatINR, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { submitLeadAction } from "@/server/actions/leads";
import { Button, IconButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { RangeField, TextField } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { Honeypot } from "@/components/forms/honeypot";
import { WishlistButton } from "@/components/vehicle/toggles";
import { usedEmi } from "@/components/vehicle/card-utils";
import { useUI, useUser } from "@/components/providers/app-provider";

const NETWORK_ERROR = "Couldn't send — check your connection and try again.";

type ActionCar = Pick<UsedCar, "id" | "price" | "city" | "variant" | "seller">;

/** Wishlist + share, shown beside the page title. */
export function UsedShareSave({ id, title }: { id: string; title: string }) {
  const { toast } = useUI();
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied — share it with anyone", { tone: "success" });
    } catch {
      toast("Couldn't copy the link. Copy it from the address bar instead.", { tone: "error" });
    }
  };
  return (
    <div className="flex shrink-0 items-center gap-2">
      <WishlistButton kind="used" id={id} label={title} tone="outline" />
      <IconButton aria-label={`Copy link to ${title}`} onClick={share}>
        <Share2 className="size-[18px]" aria-hidden />
      </IconButton>
    </div>
  );
}

/**
 * Primary purchase actions (desktop panel) plus the fixed mobile action bar
 * and the "Make an offer" sheet, which share state.
 */
export function UsedPurchaseActions({
  car,
  title,
  fairLow,
  fairHigh,
}: {
  car: ActionCar;
  title: string;
  fairLow: number;
  fairHigh: number;
}) {
  const { openEnquiry } = useUI();
  const [offerOpen, setOfferOpen] = useState(false);
  const [barHidden, setBarHidden] = useState(false);

  // Slide the mobile bar away while the footer is on screen so it never covers it.
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const io = new IntersectionObserver(([entry]) => setBarHidden(entry.isIntersecting), { rootMargin: "0px 0px -24px 0px" });
    io.observe(footer);
    return () => io.disconnect();
  }, []);
  const detail = `${car.variant} · ${car.city}`;
  const testDrive = () => openEnquiry({ kind: "test-drive", subject: title, detail, usedCarId: car.id });
  const contact = () =>
    openEnquiry({ kind: "contact-dealer", subject: car.seller.name, detail: `About the ${title}`, usedCarId: car.id, dealerId: car.seller.dealerId });

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-2.5">
        <Button size="lg" onClick={testDrive} icon={<CalendarCheck className="size-4" aria-hidden />}>
          Book test drive
        </Button>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
          <Button variant="outline" onClick={() => setOfferOpen(true)} icon={<HandCoins className="size-4" aria-hidden />}>
            Make an offer
          </Button>
          <Button variant="outline" onClick={contact} icon={<MessageSquare className="size-4" aria-hidden />}>
            Contact seller
          </Button>
        </div>
      </div>

      {/* Fixed mobile action bar — the page reserves 76px + safe area below its content */}
      <div
        aria-hidden={barHidden || undefined}
        inert={barHidden}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[55] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-transform duration-[400ms] ease-[var(--ease-premium)] lg:hidden",
          barHidden && "translate-y-full",
        )}
      >
        <div className="container-x flex h-[76px] items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold leading-tight num">{formatPrice(car.price)}</p>
            <p className="truncate text-[11.5px] text-muted num">EMI {formatINR(usedEmi(car.price))}/mo</p>
          </div>
          <Button variant="outline" className="px-4" onClick={() => setOfferOpen(true)}>
            Offer
          </Button>
          <Button className="px-4" onClick={testDrive}>
            Test drive
          </Button>
        </div>
      </div>

      <Modal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        title="Make an offer"
        description={`${title} · asking ${formatPrice(car.price)}`}
      >
        <OfferForm car={car} title={title} fairLow={fairLow} fairHigh={fairHigh} onDone={() => setOfferOpen(false)} />
      </Modal>
    </>
  );
}

const QUICK = [90, 93, 95, 98];

function OfferForm({
  car,
  title,
  fairLow,
  fairHigh,
  onDone,
}: {
  car: ActionCar;
  title: string;
  fairLow: number;
  fairHigh: number;
  onDone: () => void;
}) {
  const { toast } = useUI();
  const { user } = useUser();
  const pathname = usePathname();
  const [pct, setPct] = useState(95);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [website, setWebsite] = useState("");

  const offer = Math.round((car.price * pct) / 100 / 5000) * 5000;
  const below = car.price - offer;
  const inFair = offer >= fairLow && offer <= fairHigh;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setSending(true);
    try {
      const res = await submitLeadAction({
        type: "used_car",
        name: user && user.name.trim().length >= 2 ? user.name.trim() : undefined,
        phone,
        usedCarId: car.id,
        subject: title.slice(0, 200),
        source: pathname,
        website,
        details: { offer, askingPrice: Math.round(car.price) },
      });
      setSending(false);
      if (!res.ok) {
        const fieldErrors = res.fieldErrors ?? {};
        if (fieldErrors.phone) setError(fieldErrors.phone);
        const note = Object.entries(fieldErrors).find(([key]) => key !== "phone")?.[1] ?? res.error;
        if (note) toast(note, { tone: "error" });
        return;
      }
      toast(`Offer of ${formatPrice(offer)} received (ref ${res.reference}). We'll pass it to ${car.seller.name.replace(/\.$/, "")} and get back to you within 24 hours.`, {
        tone: "success",
      });
      onDone();
    } catch {
      setSending(false);
      toast(NETWORK_ERROR, { tone: "error" });
    }
  };

  return (
    <form onSubmit={submit} className="px-6 pb-7 pt-6 sm:px-8" noValidate>
      <Honeypot value={website} onChange={setWebsite} />
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[12.5px] text-muted">Your offer</p>
          <p className="mt-1 text-[2.25rem] font-semibold leading-none tracking-[-0.03em]">{formatPrice(offer)}</p>
        </div>
        <p className="pb-1 text-right text-[13px] text-muted num">
          {below > 0 ? (
            <>
              {formatPrice(below)} below asking
              <br />
              <span className="text-ink">{(100 - pct).toFixed(1).replace(/\.0$/, "")}% off</span>
            </>
          ) : (
            "Full asking price"
          )}
        </p>
      </div>

      <RangeField
        className="mt-7"
        label="Share of asking price"
        value={pct}
        min={85}
        max={100}
        step={0.5}
        onChange={setPct}
        format={(v) => `${v}%`}
        minLabel="85%"
        maxLabel="100%"
      />

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Quick offers">
        {QUICK.map((q) => (
          <Chip key={q} selected={pct === q} onClick={() => setPct(q)} className="h-8 px-3.5 text-[12.5px]">
            {q}%
          </Chip>
        ))}
      </div>

      <p
        className={cn(
          "mt-6 border-l-2 pl-4 text-[13px] leading-relaxed",
          inFair ? "border-ink text-ink" : "border-red text-muted",
        )}
      >
        {inFair
          ? "Within the fair-market range for this car — sellers accept offers like this most often."
          : `Below the fair-market range (${formatPrice(fairLow)} – ${formatPrice(fairHigh)}). The seller may counter.`}
      </p>

      <TextField
        className="mt-6"
        label="Mobile number"
        prefix="+91"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98765 43210"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 11));
          setError(undefined);
        }}
        error={error}
        hint="The seller replies through March Gear — your number stays private."
      />

      <Button
        type="submit"
        size="lg"
        className="mt-7 w-full"
        disabled={sending}
        icon={sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
      >
        {sending ? "Sending…" : `Send offer of ${formatPrice(offer)}`}
      </Button>
      <p className="mt-3 text-center text-[11.5px] text-muted">Offers are non-binding until both parties confirm.</p>
    </form>
  );
}
