"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Info, MapPin } from "lucide-react";
import type { UserPreferences } from "@/lib/action-result";
import { savePreferencesAction } from "@/server/actions/account";
import { useCity, useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { FormSection, SaveBar, Toggle, useAction } from "@/components/portal/profile/kit";

const ALERTS = [
  { key: "price", label: "Price and offer changes", hint: "When a saved car's price changes or a dealer offer starts on it." },
  { key: "launch", label: "Launches and first drives", hint: "New models in the segments you browse." },
  { key: "digest", label: "Weekly digest", hint: "Our editors' picks from the week, every Friday." },
  { key: "whatsapp", label: "WhatsApp updates", hint: "Booking confirmations and dealer replies on WhatsApp." },
] as const;

const CONTACT: { value: UserPreferences["contact"]; label: string }[] = [
  { value: "call", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
];

/** Alert and contact preferences (/account/preferences). Saved on the account with savePreferencesAction. */
export function PreferencesForm({ initial, chosen }: { initial: UserPreferences; chosen: boolean }) {
  const router = useRouter();
  const { city } = useCity();
  const { setLocationOpen } = useUI();
  const [saved, setSaved] = useState(initial);
  const [prefs, setPrefs] = useState(initial);
  const [first, setFirst] = useState(!chosen);
  const { busy, run } = useAction();
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);

  const save = async () => {
    const res = await run(() => savePreferencesAction(prefs), "Preferences saved");
    if (res) {
      setSaved(prefs);
      setFirst(false);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 border border-line border-l-2 border-l-ink bg-white px-5 py-4">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink/70" />
        <div className="text-[13px] leading-relaxed">
          <p className="font-medium">Email and WhatsApp delivery isn&apos;t connected yet.</p>
          <p className="mt-0.5 text-muted">
            MarchGear doesn&apos;t send emails, texts or WhatsApp messages yet, so these choices are saved for when it does. Updates on your enquiries, test drives, insurance quotes and car
            reminders already appear in your account under{" "}
            <Link href="/account/notifications" className="font-medium text-ink underline underline-offset-4 hover:text-red">
              Notifications
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="@container border border-line bg-white p-5 md:p-7">
        <FormSection title="Alerts" description="What you'd like to hear about from us.">
          <ul className="divide-y divide-line border border-line">
            {ALERTS.map((a) => (
              <li key={a.key} className="px-4 py-3.5">
                <Toggle checked={prefs.alerts[a.key]} label={a.label} hint={a.hint} onChange={(on) => setPrefs((p) => ({ ...p, alerts: { ...p.alerts, [a.key]: on } }))} />
              </li>
            ))}
          </ul>
        </FormSection>

        <FormSection title="How to reach you" description="Your preferred way to be contacted about your requests.">
          <Segmented ariaLabel="Preferred contact method" className="flex w-full max-w-md" options={CONTACT} value={prefs.contact} onChange={(v) => setPrefs((p) => ({ ...p, contact: v }))} />
          <p className="mt-2.5 text-[12px] text-muted">Dealers and insurers you send a request to still see the mobile number and email on that request.</p>
        </FormSection>

        <SaveBar
          busy={busy}
          dirty={dirty || first}
          onSave={save}
          onReset={dirty ? () => setPrefs(saved) : undefined}
          note={first && !dirty ? "These are our suggested settings — save them to confirm." : undefined}
        />
      </div>

      <section className="@container border border-line bg-white p-5 md:p-7">
        <FormSection title="Pricing city" description="On-road prices, offers and nearby dealers across the site use this city. It's kept in this browser.">
          <div className="flex flex-wrap items-center justify-between gap-4 border border-line px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-mist">
                <MapPin aria-hidden className="size-4 text-red" />
              </span>
              <div>
                <p className="text-[14px] font-medium">{city.name}</p>
                <p className="text-[12px] text-muted">{city.state}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setLocationOpen(true)}>
              Change city
            </Button>
          </div>
        </FormSection>
      </section>

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
        <Bell aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Turning an alert off never hides updates on requests you&apos;ve made — those always show in your notifications.
      </p>
    </div>
  );
}
