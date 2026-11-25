import Link from "next/link";
import { ArrowUpRight, Cookie, Download, Mail, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";
import { UnsubscribeForm } from "./unsubscribe-form";

const actions: { icon: typeof Download; title: string; body: string; href: string; cta: string }[] = [
  { icon: Download, title: "Get a copy of your data", body: "Everything in your account, as a file you can keep.", href: "/account/privacy", cta: "Download my data" },
  { icon: Pencil, title: "Correct your details", body: "Update your name, mobile, state and city.", href: "/account/profile", cta: "Edit my details" },
  { icon: SlidersHorizontal, title: "Alerts and how we contact you", body: "Choose what we tell you about, or turn it all off.", href: "/account/preferences", cta: "Change preferences" },
  { icon: Trash2, title: "Delete your account", body: "Removes your account straight away. See exactly what happens first.", href: "/account/privacy", cta: "Delete my account" },
];

function Card({ icon: Icon, title, body, children }: { icon: typeof Download; title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-col bg-white p-5 md:p-6">
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-mist">
        <Icon aria-hidden className="size-4 text-ink/70" />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{body}</p>
      <div className="mt-auto pt-4">{children}</div>
    </div>
  );
}

const cta = "group inline-flex items-center gap-1 text-[13.5px] font-medium text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:text-red hover:decoration-red";

/** Self-service privacy controls on /privacy: account tools (sign-in needed), newsletter unsubscribe, cookie choice. */
export function PrivacyChoices({ supportEmail }: { supportEmail: string }) {
  return (
    <section id="your-choices" aria-labelledby="your-choices-title" className="scroll-mt-28 border border-line bg-mist/50">
      <div className="px-5 pt-5 md:px-6 md:pt-6">
        <h3 id="your-choices-title" className="type-eyebrow text-ink">
          Your choices
        </h3>
        <p className="mt-2 text-[13px] text-muted">The account tools need you to be signed in to your MarchGear account.</p>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-px border-t border-line bg-line sm:grid-cols-2">
        {actions.map((a) => (
          <Card key={a.title} icon={a.icon} title={a.title} body={a.body}>
            <Link href={a.href} className={cta}>
              {a.cta}
              <ArrowUpRight aria-hidden className="size-3.5 text-red" />
            </Link>
          </Card>
        ))}
        <Card icon={Cookie} title="Analytics cookies" body="Allow or refuse Google Analytics. You can change your mind at any time.">
          <CookieSettingsButton className={cta} />
        </Card>
        <Card icon={Mail} title="Something else?" body="Erasing guest requests, nominating someone, or a summary of who we shared your data with.">
          <a href={`mailto:${supportEmail}?subject=Privacy%20request`} className={`${cta} break-all`}>
            Email {supportEmail}
          </a>
        </Card>
      </div>
      <div className="border-t border-line bg-white px-5 py-5 md:px-6">
        <h3 id="unsubscribe" className="text-[15px] font-semibold text-ink">
          Unsubscribe from The Weekly Gear
        </h3>
        <p className="mb-4 mt-1 text-[13.5px] text-muted">Enter the address you signed up with. It&apos;s removed from the list straight away.</p>
        <UnsubscribeForm />
      </div>
    </section>
  );
}
