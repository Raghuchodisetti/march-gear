"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  Bell,
  GitCompareArrows,
  Heart,
  History,
  LogOut,
  MapPin,
  PenLine,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { getCar } from "@/data/cars";
import { brandName } from "@/data/brands";
import { cities } from "@/data/cities";
import { getUsedCar } from "@/data/used-cars";
import { IMG } from "@/data/images";
import { ACTIVITY_LABEL, accountActivity, type ActivityStatus } from "@/data/account-activity";
import type { MockUser } from "@/lib/store";
import { formatDate, formatPrice, formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented, SelectField, TextField } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { useIsClient } from "@/components/ui/overlay";
import { useCity, useCompare, useUI, useUser, useWishlist } from "@/components/providers/app-provider";
import { Switch } from "@/components/tools/fields";
import { usedTitle } from "@/components/vehicle/used-car-card";
import { Avatar } from "./avatar";
import { EMAIL_RE, MOBILE_RE, mobileDigits, prettyMobile } from "./validation";

type Section = "details" | "saved" | "compare" | "activity" | "preferences";

const SECTIONS: { value: Section; label: string; icon: typeof UserRound }[] = [
  { value: "details", label: "Personal details", icon: UserRound },
  { value: "saved", label: "Saved cars", icon: Heart },
  { value: "compare", label: "Compare list", icon: GitCompareArrows },
  { value: "activity", label: "Recent activity", icon: History },
  { value: "preferences", label: "Preferences", icon: SlidersHorizontal },
];

export function ProfileView() {
  const isClient = useIsClient();
  const router = useRouter();
  const { user, update, logout } = useUser();
  const { toast } = useUI();
  const { count } = useWishlist();
  const { slugs } = useCompare();
  const [section, setSection] = useState<Section>("details");
  const [leaving, setLeaving] = useState(false);

  if (!isClient || leaving) return <ProfileSkeleton />;
  if (!user) return <SignedOut />;

  const signOut = () => {
    setLeaving(true);
    logout();
    toast("You've been signed out");
    router.push("/");
  };

  const current = SECTIONS.find((s) => s.value === section) ?? SECTIONS[0];

  const onNavKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = SECTIONS.findIndex((s) => s.value === section);
    const next = SECTIONS[(i + (e.key === "ArrowDown" ? 1 : SECTIONS.length - 1)) % SECTIONS.length];
    setSection(next.value);
    document.getElementById(`profile-tab-${next.value}`)?.focus();
  };

  return (
    <>
      <section className="border-b border-line">
        <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
          <Breadcrumbs items={[{ label: "Profile" }]} />
          <div className="mt-10 flex flex-col gap-10 md:mt-14 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-5 md:gap-8">
              <Avatar name={user.name} className="size-16 text-2xl md:size-24 md:text-4xl" />
              <div className="min-w-0">
                <Eyebrow>Member since {user.memberSince}</Eyebrow>
                <h1 className="type-h1 mt-4 break-words">{user.name}</h1>
                <p className="mt-3 truncate text-[14px] text-muted">
                  {[user.city, user.email || user.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 border-y border-line lg:min-w-[420px]">
              {[
                { label: "Saved", value: count, to: "saved" as const },
                { label: "Comparing", value: slugs.length, to: "compare" as const },
                { label: "Enquiries", value: accountActivity.length, to: "activity" as const },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSection(s.to)}
                  className="group/stat border-l border-line px-4 py-4 text-left first:border-l-0 first:pl-0 md:px-6"
                >
                  <span className="block font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num md:text-[34px]">{s.value}</span>
                  <span className="mt-2 block text-[12.5px] text-muted transition-colors group-hover/stat:text-ink">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="container-x grid grid-cols-1 gap-8 py-10 md:py-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
        <aside className="hidden lg:block">
          <nav aria-label="Profile" className="sticky top-[104px]">
            <div role="tablist" aria-orientation="vertical" aria-label="Profile sections" onKeyDown={onNavKey} className="border-t border-line">
              {SECTIONS.map(({ value, label, icon: Icon }) => {
                const active = value === section;
                return (
                  <button
                    key={value}
                    id={`profile-tab-${value}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="profile-panel"
                    tabIndex={active ? 0 : -1}
                    onClick={() => setSection(value)}
                    className={cn(
                      "relative flex w-full items-center gap-3 border-b border-line py-4 pl-4 text-left text-[14.5px] transition-colors duration-[250ms]",
                      active ? "font-medium text-ink" : "text-muted hover:text-ink",
                    )}
                  >
                    <span aria-hidden className={cn("absolute inset-y-3 left-0 w-[2px] transition-colors duration-[250ms]", active ? "bg-red" : "bg-transparent")} />
                    <Icon aria-hidden className="size-4" strokeWidth={1.8} />
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="mt-8 inline-flex items-center gap-2 pl-4 text-[14px] text-muted transition-colors hover:text-red"
            >
              <LogOut aria-hidden className="size-4" /> Sign out
            </button>
          </nav>
        </aside>

        <div className="min-w-0">
          <Tabs
            className="-mx-5 px-5 md:mx-0 md:px-0 lg:hidden"
            ariaLabel="Profile sections"
            items={SECTIONS.map((s) => ({ value: s.value, label: s.label }))}
            value={section}
            onChange={(v) => setSection(v as Section)}
          />
          <div id="profile-panel" role="tabpanel" aria-label={current.label} className="pt-10 lg:pt-0">
            {section === "details" && <DetailsPanel user={user} onSave={update} />}
            {section === "saved" && <SavedPanel />}
            {section === "compare" && <ComparePanel />}
            {section === "activity" && <ActivityPanel />}
            {section === "preferences" && <PreferencesPanel />}
          </div>
          <div className="mt-14 border-t border-line pt-6 lg:hidden">
            <Button variant="outline" className="w-full" icon={<LogOut className="size-4" aria-hidden />} onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function PanelHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="type-h3">{title}</h2>
        {description && <p className="mt-1.5 text-[14px] text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Personal details ───────────────────────────────────────── */

type DetailErrors = Partial<Record<"name" | "email" | "mobile", string>>;

function DetailsPanel({ user, onSave }: { user: MockUser; onSave: (patch: Partial<MockUser>) => void }) {
  const { toast } = useUI();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", city: "" });
  const [errors, setErrors] = useState<DetailErrors>({});

  const startEditing = () => {
    const match = cities.find((c) => c.name === user.city);
    setForm({ name: user.name, email: user.email, mobile: mobileDigits(user.phone), city: match?.slug ?? cities[0].slug });
    setErrors({});
    setEditing(true);
  };

  const set = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (key in errors) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    const next: DetailErrors = {
      name: form.name.trim().length >= 2 ? undefined : "Enter your full name",
      email: email && !EMAIL_RE.test(email) ? "Enter a valid email address" : !email && !form.mobile ? "Add an email or a mobile number" : undefined,
      mobile: form.mobile && !MOBILE_RE.test(form.mobile) ? "Enter a valid 10-digit mobile number" : undefined,
    };
    setErrors(next);
    const first = (["name", "email", "mobile"] as const).find((k) => next[k]);
    if (first) {
      document.getElementById(`profile-${first}`)?.focus();
      return;
    }
    onSave({
      name: form.name.trim().replace(/\s+/g, " "),
      email,
      phone: form.mobile ? prettyMobile(form.mobile) : "",
      city: cities.find((c) => c.slug === form.city)?.name ?? user.city,
    });
    setEditing(false);
    toast("Profile updated", { tone: "success" });
  };

  if (editing) {
    return (
      <form noValidate onSubmit={save}>
        <PanelHeader title="Edit personal details" description="Used to pre-fill test-drive and quote requests." />
        <div className="mt-8 grid max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="profile-name"
            className="sm:col-span-2"
            label="Full name"
            autoComplete="name"
            value={form.name}
            error={errors.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <TextField id="profile-email" label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
          <TextField
            id="profile-mobile"
            label="Mobile"
            type="tel"
            prefix="+91"
            inputMode="numeric"
            maxLength={10}
            autoComplete="tel-national"
            value={form.mobile}
            error={errors.mobile}
            onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
          <SelectField
            className="sm:col-span-2"
            label="City"
            options={cities.map((c) => ({ value: c.slug, label: `${c.name}, ${c.state}` }))}
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="submit" variant="dark">
            Save changes
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: "Full name", value: user.name },
    { label: "Email", value: user.email },
    { label: "Mobile", value: user.phone },
    { label: "City", value: user.city },
    { label: "Member since", value: user.memberSince },
  ];

  return (
    <div>
      <PanelHeader
        title="Personal details"
        description="Used to pre-fill test-drive and quote requests."
        action={
          <Button variant="outline" size="sm" icon={<PenLine className="size-3.5" aria-hidden />} onClick={startEditing}>
            Edit details
          </Button>
        }
      />
      <dl className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-10">
        {rows.map((r) => (
          <div key={r.label} className="border-b border-line py-5">
            <dt className="text-[12.5px] text-muted">{r.label}</dt>
            <dd className={cn("mt-1 break-words text-[15px]", r.value ? "font-medium text-ink" : "text-muted")}>
              {r.value || (
                <button type="button" onClick={startEditing} className="underline underline-offset-4 hover:text-ink">
                  Add {r.label.toLowerCase()}
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Saved cars ─────────────────────────────────────────────── */

function SavedPanel() {
  const { wishlist } = useWishlist();
  const newCars = wishlist.cars.map(getCar).filter((c) => c !== undefined);
  const usedList = wishlist.used.map(getUsedCar).filter((c) => c !== undefined);

  return (
    <div>
      <PanelHeader
        title="Saved cars"
        description={`${newCars.length} new · ${usedList.length} used`}
        action={(newCars.length > 0 || usedList.length > 0) && <TextLink href="/wishlist">Manage saved cars</TextLink>}
      />
      {newCars.length === 0 && usedList.length === 0 ? (
        <InlineEmpty
          icon={<Heart className="size-5" aria-hidden />}
          title="Nothing saved yet"
          body="Tap the heart on any car to keep it here. Your shortlist follows you across devices once you're signed in."
        >
          <Button href="/new-cars" variant="dark" size="sm" arrow>
            Browse new cars
          </Button>
          <Button href="/used-cars" variant="outline" size="sm">
            Used cars
          </Button>
        </InlineEmpty>
      ) : (
        <div className="space-y-12 pt-8">
          {[
            {
              key: "new",
              label: "New cars",
              total: newCars.length,
              items: newCars.slice(0, 4).map((c) => ({ id: c.slug, href: `/cars/${c.slug}`, image: c.images[0], focus: c.focus, title: `${brandName(c.brand)} ${c.name}`, meta: formatPriceRange(c.priceMin, c.priceMax) })),
              empty: { label: "Explore new cars", href: "/new-cars" },
            },
            {
              key: "used",
              label: "Used cars",
              total: usedList.length,
              items: usedList.slice(0, 4).map((c) => ({ id: c.id, href: `/used-cars/${c.id}`, image: c.images[0], focus: c.focus, title: usedTitle(c), meta: formatPrice(c.price) })),
              empty: { label: "Explore used cars", href: "/used-cars" },
            },
          ].map((group) => (
            <div key={group.key}>
              <p className="type-eyebrow flex items-center gap-2 text-muted">
                {group.label} <span className="num text-ink">{group.total}</span>
              </p>
              {group.items.length === 0 ? (
                <p className="mt-4 text-[14px] text-muted">
                  None saved.{" "}
                  <Link href={group.empty.href} className="text-ink underline underline-offset-4 hover:text-red">
                    {group.empty.label}
                  </Link>
                </p>
              ) : (
                <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
                  {group.items.map((item, i) => {
                    const overflow = i === 3 && group.total > 4;
                    return (
                    <li key={item.id} className="min-w-0">
                      <Link href={overflow ? "/wishlist" : item.href} className="group/thumb block" aria-label={overflow ? `${item.title} and ${group.total - 4} more saved — view all` : undefined}>
                        <div className="relative aspect-[4/3] overflow-hidden bg-mist">
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            sizes="(min-width: 1024px) 200px, 45vw"
                            className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/thumb:scale-[1.04]"
                            style={{ objectPosition: item.focus ?? "50% 55%" }}
                          />
                          {overflow && (
                            <span className="absolute inset-0 flex items-center justify-center bg-ink/70 text-[14px] font-medium text-white">
                              +{group.total - 3} more
                            </span>
                          )}
                        </div>
                        <p className="mt-2.5 truncate text-[14px] font-medium">{item.title}</p>
                        <p className="text-[12.5px] text-muted num">{item.meta}</p>
                      </Link>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Compare list ───────────────────────────────────────────── */

function ComparePanel() {
  const { slugs, remove, clear, max } = useCompare();
  const { toast } = useUI();
  const list = slugs.map(getCar).filter((c) => c !== undefined);

  return (
    <div>
      <PanelHeader
        title="Compare list"
        description={`${list.length} of ${max} cars`}
        action={
          list.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clear();
                toast("Compare list cleared");
              }}
              className="text-[13px] text-muted underline-offset-4 transition-colors hover:text-red hover:underline"
            >
              Clear list
            </button>
          )
        }
      />
      {list.length === 0 ? (
        <InlineEmpty
          icon={<GitCompareArrows className="size-5" aria-hidden />}
          title="Nothing to compare yet"
          body="Tick “Compare” on up to four cars and line them up spec for spec — price, safety, efficiency and features."
        >
          <Button href="/new-cars" variant="dark" size="sm" arrow>
            Browse new cars
          </Button>
          <Button href="/compare" variant="outline" size="sm">
            Open compare
          </Button>
        </InlineEmpty>
      ) : (
        <>
          <ul>
            {list.map((car) => {
              const t = `${brandName(car.brand)} ${car.name}`;
              return (
                <li key={car.slug} className="flex items-center gap-4 border-b border-line py-4">
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden bg-mist">
                    <Image src={car.images[0]} alt="" fill sizes="80px" className="object-cover" style={{ objectPosition: car.focus ?? "50% 55%" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/cars/${car.slug}`} className="type-h4 block truncate hover:text-red">
                      {t}
                    </Link>
                    <p className="text-[12.5px] text-muted num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
                  </div>
                  <IconButton aria-label={`Remove ${t} from compare`} size="sm" onClick={() => remove(car.slug)}>
                    <X className="size-4" aria-hidden />
                  </IconButton>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {list.length >= 2 ? (
              <Button href={`/compare?cars=${list.map((c) => c.slug).join(",")}`} variant="primary" arrow>
                Compare {list.length} cars
              </Button>
            ) : (
              <>
                <Button variant="primary" disabled>
                  Compare
                </Button>
                <p className="text-[13px] text-muted">Add at least one more car to compare.</p>
              </>
            )}
            {list.length < max && <TextLink href="/new-cars">Add another car</TextLink>}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Activity ───────────────────────────────────────────────── */

const STATUS_TONE: Record<ActivityStatus, "ink" | "red" | "outline" | "mist"> = {
  Confirmed: "ink",
  "Quotes received": "red",
  "In progress": "outline",
  Completed: "mist",
};

function ActivityPanel() {
  const { openEnquiry } = useUI();
  return (
    <div>
      <PanelHeader
        title="Recent activity"
        description="Bookings, quotes and requests from the last 30 days."
        action={
          <Button variant="outline" size="sm" onClick={() => openEnquiry({ kind: "callback", subject: "March Gear concierge", detail: "Help with an existing request" })}>
            Get help with a request
          </Button>
        }
      />
      <ol>
        {accountActivity.map((a) => (
          <li key={a.id} className="grid grid-cols-1 gap-3 border-b border-line py-6 md:grid-cols-[132px_minmax(0,1fr)_auto] md:items-start md:gap-8">
            <div className="flex items-center gap-3 md:block">
              <p className="text-[13px] font-medium num">{formatDate(a.date)}</p>
              <p className="type-eyebrow text-muted md:mt-2">{ACTIVITY_LABEL[a.kind]}</p>
            </div>
            <div className="min-w-0">
              <p className="type-h4">{a.title}</p>
              <p className="mt-1 text-[14px] text-muted">{a.detail}</p>
            </div>
            <div className="flex items-center justify-between gap-6 md:flex-col md:items-end md:gap-3">
              <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
              <TextLink href={a.href}>{a.cta}</TextLink>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Preferences ────────────────────────────────────────────── */

const ALERTS = [
  { key: "price", label: "Price-drop alerts", description: "When a saved car's price or offers change." },
  { key: "launch", label: "Launches & first drives", description: "New models in the segments you browse." },
  { key: "digest", label: "Weekly digest", description: "Our editors' picks, every Sunday morning." },
  { key: "whatsapp", label: "WhatsApp updates", description: "Booking confirmations and dealer replies." },
] as const;

function PreferencesPanel() {
  const { city } = useCity();
  const { setLocationOpen, toast } = useUI();
  const [alerts, setAlerts] = useState<Record<(typeof ALERTS)[number]["key"], boolean>>({ price: true, launch: true, digest: false, whatsapp: false });
  const [contact, setContact] = useState<"call" | "whatsapp" | "email">("whatsapp");

  return (
    <div className="space-y-14">
      <div>
        <PanelHeader title="Location" description="Sets on-road prices, offers and nearby dealers." />
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-mist">
              <MapPin aria-hidden className="size-4 text-red" />
            </span>
            <div>
              <p className="text-[15px] font-medium">{city.name}</p>
              <p className="text-[12.5px] text-muted">{city.state}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocationOpen(true)}>
            Change city
          </Button>
        </div>
      </div>

      <div>
        <PanelHeader title="Notifications" description="Choose what we're allowed to tell you about." />
        <div className="divide-y divide-line border-b border-line">
          {ALERTS.map((a) => (
            <Switch
              key={a.key}
              className="py-5"
              label={a.label}
              description={a.description}
              checked={alerts[a.key]}
              onChange={(on) => {
                setAlerts((p) => ({ ...p, [a.key]: on }));
                toast(`${a.label} ${on ? "turned on" : "turned off"}`, { tone: on ? "success" : "default" });
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <PanelHeader title="Dealer contact" description="How dealers should reach you about your requests." />
        <div className="pt-6">
          <Segmented
            ariaLabel="Preferred contact method"
            className="flex w-full max-w-md"
            options={[
              { value: "call", label: "Phone call" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "email", label: "Email" },
            ]}
            value={contact}
            onChange={(v) => {
              setContact(v);
              toast(`Dealers will contact you by ${v === "call" ? "phone" : v === "whatsapp" ? "WhatsApp" : "email"}`, { tone: "success" });
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border border-line p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Bell aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <p className="text-[13.5px] leading-relaxed text-muted">
            Want your data removed? Deleting your account erases saved cars, comparisons and enquiry history.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 text-muted hover:text-red" onClick={() => toast("Account deletion is disabled in this demo")}>
          Delete account
        </Button>
      </div>
    </div>
  );
}

/* ── States ─────────────────────────────────────────────────── */

function InlineEmpty({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-5 py-10 sm:flex-row sm:items-center sm:gap-8">
      <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-mist text-ink">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="type-h4">{title}</p>
        <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">{body}</p>
        <div className="mt-5 flex flex-wrap gap-3">{children}</div>
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <section className="border-b border-line">
      <div className="container-x pt-8 md:pt-10">
        <Breadcrumbs items={[{ label: "Profile" }]} />
      </div>
      <div className="container-x grid grid-cols-1 gap-12 pb-16 pt-10 md:pb-24 md:pt-14 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6">
          <Eyebrow>Your garage</Eyebrow>
          <h1 className="type-h1 mt-5 text-balance">
            Sign in to see your <span className="type-editorial">profile</span>.
          </h1>
          <p className="type-lead mt-5 max-w-lg text-muted">Your shortlist, comparisons, bookings and alerts — kept in one place and synced across devices.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button href="/login" variant="dark" size="lg" arrow>
              Sign in
            </Button>
            <Button href="/login?mode=register" variant="outline" size="lg">
              Create account
            </Button>
          </div>
          <ul className="mt-14 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
            {[
              { icon: Heart, title: "Saved cars", body: "Your shortlist, everywhere." },
              { icon: GitCompareArrows, title: "Comparisons", body: "Pick up where you left off." },
              { icon: Bell, title: "Price alerts", body: "Know when offers change." },
            ].map(({ icon: Icon, title, body }) => (
              <li key={title} className="bg-white p-5">
                <Icon aria-hidden className="size-4 text-red" strokeWidth={1.8} />
                <p className="mt-4 text-[14px] font-medium">{title}</p>
                <p className="mt-0.5 text-[13px] text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden bg-mist sm:aspect-[16/10] lg:col-span-5 lg:col-start-8 lg:aspect-[4/5]">
          <Image src={IMG.garage} alt="A car parked in a quiet private garage" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
        </div>
      </div>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your profile">
      <div className="border-b border-line">
        <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
          <div className="skeleton h-3 w-28" />
          <div className="mt-10 flex items-center gap-6 md:mt-14">
            <div className="skeleton size-16 md:size-24" />
            <div className="flex-1">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton mt-4 h-10 w-2/3 max-w-md md:h-14" />
            </div>
          </div>
        </div>
      </div>
      <div className="container-x grid grid-cols-1 gap-10 py-12 lg:grid-cols-[240px_1fr] lg:gap-16">
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-11" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      </div>
    </div>
  );
}
