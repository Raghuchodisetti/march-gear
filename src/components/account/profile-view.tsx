"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertCircle,
  Bell,
  GitCompareArrows,
  Heart,
  History,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  PenLine,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { cities } from "@/data/cities";
import { IMG } from "@/data/images";
import type { LeadStatus } from "@/db/enums";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/action-result";
import type { AccountUser } from "@/lib/store";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, detailLabel, detailValue } from "@/lib/leads";
import { formatDate, formatPrice, formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { myPreferencesAction, myRequestsAction, savePreferencesAction, type MyRequest } from "@/server/actions/account";
import { changePasswordAction, updateProfileAction } from "@/server/actions/auth";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Segmented, SelectField, TextField } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { useCity, useCompare, useUI, useUser, useWishlist } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Switch } from "@/components/tools/fields";
import { usedTitle } from "@/components/vehicle/card-utils";
import { Avatar } from "./avatar";
import { MIN_PASSWORD, MOBILE_RE, displayMobile, mobileDigits } from "./validation";

type Section = "details" | "saved" | "compare" | "activity" | "preferences";

const SECTIONS: { value: Section; label: string; icon: typeof UserRound }[] = [
  { value: "details", label: "Personal details", icon: UserRound },
  { value: "saved", label: "Saved cars", icon: Heart },
  { value: "compare", label: "Compare list", icon: GitCompareArrows },
  { value: "activity", label: "Recent activity", icon: History },
  { value: "preferences", label: "Preferences", icon: SlidersHorizontal },
];

const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";
/** The server returns at most this many requests. */
const REQUESTS_LIMIT = 50;

const FORM_ERROR = "border-l-2 border-red bg-red-50 px-3 py-2.5 text-[13.5px] text-red";

/** ISO timestamp → "November 2026" / "Nov 2026" (falls back to the raw value for older cached accounts). */
function monthYear(iso: string, month: "long" | "short" = "long") {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { month, year: "numeric" });
}

/** ISO timestamp → the visitor's local calendar day as YYYY-MM-DD, for formatDate. */
function localDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ProfileView() {
  const router = useRouter();
  const { user, ready, update, logout } = useUser();
  const { toast } = useUI();
  const { count } = useWishlist();
  const { slugs } = useCompare();
  const [section, setSection] = useState<Section>("details");
  const [leaving, setLeaving] = useState(false);
  const requests = useMyRequests(ready ? user?.id : undefined);

  // Wait for the server to confirm the session so a signed-in member never sees the signed-out page.
  if (!ready || leaving) return <ProfileSkeleton />;
  if (!user) return <SignedOut />;

  const signOut = async () => {
    setLeaving(true);
    await logout();
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

  const enquiries: ReactNode =
    requests.state.status === "done" ? (
      requests.state.requests.length >= REQUESTS_LIMIT ? `${REQUESTS_LIMIT}+` : requests.state.requests.length
    ) : requests.state.status === "loading" ? (
      <>
        <span aria-hidden className="skeleton inline-block h-[28px] w-8 align-top md:h-[34px]" />
        <span className="sr-only">Loading</span>
      </>
    ) : (
      "—"
    );

  return (
    <>
      <section className="border-b border-line">
        <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
          <Breadcrumbs items={[{ label: "Profile" }]} />
          <div className="mt-10 flex flex-col gap-10 md:mt-14 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-5 md:gap-8">
              <Avatar name={user.name} className="size-16 text-2xl md:size-24 md:text-4xl" />
              <div className="min-w-0">
                <Eyebrow>Member since {monthYear(user.memberSince, "short")}</Eyebrow>
                <h1 className="type-h1 mt-4 break-words">{user.name}</h1>
                <p className="mt-3 truncate text-[14px] text-muted">{[user.city, user.email].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 border-y border-line lg:min-w-[420px]">
              {[
                { label: "Saved", value: count as ReactNode, to: "saved" as const },
                { label: "Comparing", value: slugs.length as ReactNode, to: "compare" as const },
                { label: "Enquiries", value: enquiries, to: "activity" as const },
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
            {section === "details" && (
              <div className="space-y-14">
                <DetailsPanel user={user} onSave={update} />
                <PasswordPanel email={user.email} />
              </div>
            )}
            {section === "saved" && <SavedPanel />}
            {section === "compare" && <ComparePanel />}
            {section === "activity" && <ActivityPanel state={requests.state} onRetry={requests.retry} />}
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

function Busy({ children }: { children: ReactNode }) {
  return (
    <>
      <Loader2 aria-hidden className="size-4 animate-spin" /> {children}
    </>
  );
}

/* ── Personal details ───────────────────────────────────────── */

type DetailField = "name" | "mobile" | "city";
type DetailErrors = Partial<Record<DetailField, string>>;

function DetailsPanel({ user, onSave }: { user: AccountUser; onSave: (patch: Partial<AccountUser>) => void }) {
  const { toast } = useUI();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", city: "" });
  const [errors, setErrors] = useState<DetailErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Our city list, plus the member's saved city if it isn't one of them.
  const cityOptions = [
    ...(user.city && !cities.some((c) => c.name === user.city) ? [{ value: user.city, label: user.city }] : []),
    ...cities.map((c) => ({ value: c.name, label: `${c.name}, ${c.state}` })),
  ];

  const startEditing = () => {
    setForm({ name: user.name, mobile: mobileDigits(user.phone), city: user.city });
    setErrors({});
    setFormError(null);
    setEditing(true);
  };

  const set = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const focusFirst = (errs: DetailErrors) => {
    const first = (["name", "mobile", "city"] as const).find((k) => errs[k]);
    if (first) document.getElementById(`profile-${first}`)?.focus();
    return Boolean(first);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: DetailErrors = {
      name: form.name.trim().length >= 2 ? undefined : "Enter your full name",
      mobile: form.mobile && !MOBILE_RE.test(form.mobile) ? "Enter a valid 10-digit mobile number" : undefined,
    };
    setErrors(next);
    setFormError(null);
    if (focusFirst(next)) return;

    setBusy(true);
    try {
      const res = await updateProfileAction({ name: form.name.trim().replace(/\s+/g, " "), phone: form.mobile, city: form.city });
      if (!res.ok) {
        const f = res.fieldErrors ?? {};
        const mapped: DetailErrors = { name: f.name, mobile: f.phone, city: f.city };
        setErrors(mapped);
        if (!focusFirst(mapped)) setFormError(res.error ?? "We couldn't save your details. Please try again.");
        return;
      }
      onSave({ name: res.user.name, phone: res.user.phone ?? "", city: res.user.city ?? "" });
      setEditing(false);
      toast("Profile updated", { tone: "success" });
    } catch {
      setFormError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form noValidate onSubmit={save}>
        <PanelHeader title="Edit personal details" description="Used to pre-fill test-drive and quote requests." />
        {formError && (
          <p role="alert" className={cn(FORM_ERROR, "mt-8 max-w-2xl")}>
            {formError}
          </p>
        )}
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
          <div>
            <Label htmlFor="profile-email">Email</Label>
            <input
              id="profile-email"
              type="email"
              value={user.email}
              readOnly
              aria-describedby="profile-email-msg"
              className="h-12 w-full cursor-default rounded-[3px] border border-line bg-mist px-4 text-[15px] text-muted outline-none"
            />
            <p id="profile-email-msg" className="mt-1.5 text-xs text-muted">
              Your sign-in email — it can&apos;t be changed here.
            </p>
          </div>
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
            id="profile-city"
            className="sm:col-span-2"
            label="City"
            placeholder="Choose your city"
            options={cityOptions}
            value={form.city}
            error={errors.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="submit" variant="dark" disabled={busy}>
            {busy ? <Busy>Saving…</Busy> : "Save changes"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  const rows: { label: string; value: string; note?: string }[] = [
    { label: "Full name", value: user.name },
    { label: "Email", value: user.email, note: "Your sign-in email" },
    { label: "Mobile", value: user.phone ? displayMobile(user.phone) : "" },
    { label: "City", value: user.city },
    { label: "Member since", value: monthYear(user.memberSince) },
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
              {r.note && <span className="mt-0.5 block text-[12.5px] font-normal text-muted">{r.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Password ───────────────────────────────────────────────── */

type PasswordField = "current" | "next" | "confirm";
const EMPTY_PASSWORDS: Record<PasswordField, string> = { current: "", next: "", confirm: "" };

function PasswordPanel({ email }: { email: string }) {
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState<Partial<Record<PasswordField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: PasswordField, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const close = () => {
    setOpen(false);
    setForm(EMPTY_PASSWORDS);
    setErrors({});
    setFormError(null);
  };

  const focusFirst = (errs: Partial<Record<PasswordField, string>>) => {
    const first = (["current", "next", "confirm"] as const).find((k) => errs[k]);
    if (first) document.getElementById(`password-${first}`)?.focus();
    return Boolean(first);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next = {
      current: form.current ? undefined : "Enter your current password",
      next:
        form.next.length < MIN_PASSWORD
          ? `Use at least ${MIN_PASSWORD} characters`
          : form.next === form.current
            ? "Choose a password you haven't used here"
            : undefined,
      confirm: form.confirm === form.next ? undefined : "Passwords don't match",
    };
    setErrors(next);
    setFormError(null);
    if (focusFirst(next)) return;

    setBusy(true);
    try {
      const res = await changePasswordAction({ current: form.current, next: form.next });
      if (!res.ok) {
        const mapped = { current: res.fieldErrors?.current, next: res.fieldErrors?.next };
        setErrors(mapped);
        if (!focusFirst(mapped)) setFormError(res.error ?? "We couldn't change your password. Please try again.");
        return;
      }
      close();
      toast("Password changed. You've been signed out on your other devices.", { tone: "success" });
    } catch {
      setFormError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PanelHeader
        title="Password"
        description="Changing it signs you out on every other device."
        action={
          !open && (
            <Button
              variant="outline"
              size="sm"
              icon={<KeyRound className="size-3.5" aria-hidden />}
              onClick={() => {
                setOpen(true);
                requestAnimationFrame(() => document.getElementById("password-current")?.focus());
              }}
            >
              Change password
            </Button>
          )
        }
      />
      {open && (
        <form noValidate onSubmit={submit} aria-label="Change password" className="pt-8">
          {/* Lets password managers pair the new password with this account. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          {formError && (
            <p role="alert" className={cn(FORM_ERROR, "mb-6 max-w-3xl")}>
              {formError}
            </p>
          )}
          <div className="grid max-w-3xl grid-cols-1 gap-5 md:grid-cols-3">
            <TextField
              id="password-current"
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={form.current}
              error={errors.current}
              onChange={(e) => set("current", e.target.value)}
            />
            <TextField
              id="password-next"
              label="New password"
              type="password"
              autoComplete="new-password"
              value={form.next}
              error={errors.next}
              hint={errors.next ? undefined : `At least ${MIN_PASSWORD} characters`}
              onChange={(e) => set("next", e.target.value)}
            />
            <TextField
              id="password-confirm"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              error={errors.confirm}
              onChange={(e) => set("confirm", e.target.value)}
            />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="submit" variant="dark" disabled={busy}>
              {busy ? <Busy>Updating…</Busy> : "Update password"}
            </Button>
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── Saved cars ─────────────────────────────────────────────── */

function SavedPanel() {
  const { wishlist } = useWishlist();
  const { getCar, getUsedCar, brandName } = useCatalog();
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
          body="Tap the heart on any car to keep it here. Your shortlist is saved to your account, so it's on every device you sign in to."
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
              items: usedList.slice(0, 4).map((c) => ({ id: c.id, href: `/used-cars/${c.id}`, image: c.images[0], focus: c.focus, title: usedTitle(c, brandName), meta: formatPrice(c.price) })),
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
  const { getCar, brandName } = useCatalog();
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

type RequestsState = { status: "loading" } | { status: "error"; message: string } | { status: "done"; requests: MyRequest[] };

/** The signed-in member's enquiries and bookings, loaded once their session is confirmed. */
function useMyRequests(userId: number | undefined) {
  const [loaded, setLoaded] = useState<{ userId?: number; state: RequestsState }>({ state: { status: "loading" } });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (userId === undefined) return;
    let cancelled = false;
    const settle = (state: RequestsState) => {
      if (!cancelled) setLoaded({ userId, state });
    };
    myRequestsAction()
      .then((res) =>
        settle(res.ok ? { status: "done", requests: res.requests } : { status: "error", message: res.error ?? "We couldn't load your requests." }),
      )
      .catch(() => settle({ status: "error", message: NETWORK_ERROR }));
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  const retry = useCallback(() => {
    setLoaded({ state: { status: "loading" } });
    setAttempt((n) => n + 1);
  }, []);

  const state: RequestsState = userId !== undefined && loaded.userId === userId ? loaded.state : { status: "loading" };
  return { state, retry };
}

const STATUS_TONE: Record<LeadStatus, "ink" | "red" | "outline" | "mist"> = {
  new: "outline",
  contacted: "ink",
  qualified: "ink",
  converted: "red",
  closed: "mist",
};

function requestLink(r: MyRequest): { href: string; label: string } | null {
  if (r.carSlug) return { href: `/cars/${r.carSlug}`, label: "View car" };
  if (r.usedCarId) return { href: `/used-cars/${r.usedCarId}`, label: "View listing" };
  if (r.dealerId) return { href: `/dealers/${r.dealerId}`, label: "View dealer" };
  return null;
}

function requestDetails(r: MyRequest) {
  return Object.entries(r.details ?? {})
    .filter(([, v]) => v !== null && v !== "")
    .slice(0, 3)
    .map(([k, v]) => `${detailLabel(k)}: ${typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDate(v) : detailValue(k, v)}`);
}

function ActivityPanel({ state, onRetry }: { state: RequestsState; onRetry: () => void }) {
  const { openEnquiry } = useUI();
  return (
    <div>
      <PanelHeader
        title="Recent activity"
        description="Enquiries and bookings you've made while signed in, newest first."
        action={
          <Button variant="outline" size="sm" onClick={() => openEnquiry({ kind: "callback", subject: "March Gear concierge", detail: "Help with an existing request" })}>
            Get help with a request
          </Button>
        }
      />
      {state.status === "loading" ? (
        <ol aria-busy="true" aria-label="Loading your requests">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="grid grid-cols-1 gap-3 border-b border-line py-6 md:grid-cols-[132px_minmax(0,1fr)_auto] md:gap-8">
              <div className="space-y-2">
                <div className="skeleton h-3.5 w-20" />
                <div className="skeleton h-3 w-16" />
              </div>
              <div className="space-y-2">
                <div className="skeleton h-5 w-2/3" />
                <div className="skeleton h-3.5 w-1/2" />
              </div>
              <div className="skeleton h-6 w-20" />
            </li>
          ))}
        </ol>
      ) : state.status === "error" ? (
        <InlineEmpty icon={<AlertCircle className="size-5" aria-hidden />} title="We couldn't load your requests" body={state.message}>
          <Button variant="dark" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </InlineEmpty>
      ) : state.requests.length === 0 ? (
        <InlineEmpty
          icon={<History className="size-5" aria-hidden />}
          title="No requests yet"
          body="Test drives, price quotes, callbacks and messages you send while signed in will appear here, with their latest status."
        >
          <Button href="/new-cars" variant="dark" size="sm" arrow>
            Browse new cars
          </Button>
          <Button href="/contact" variant="outline" size="sm">
            Contact us
          </Button>
        </InlineEmpty>
      ) : (
        <ol>
          {state.requests.map((r) => {
            const type = LEAD_TYPE_LABEL[r.type] ?? r.type;
            const link = requestLink(r);
            const details = requestDetails(r);
            return (
              <li key={r.reference} className="grid grid-cols-1 gap-3 border-b border-line py-6 md:grid-cols-[132px_minmax(0,1fr)_auto] md:items-start md:gap-8">
                <div className="flex items-center gap-3 md:block">
                  <p className="text-[13px] font-medium num">
                    <time dateTime={r.createdAt}>{formatDate(localDay(r.createdAt))}</time>
                  </p>
                  <p className="type-eyebrow text-muted md:mt-2">{type}</p>
                </div>
                <div className="min-w-0">
                  <p className="type-h4 break-words">{r.subject || type}</p>
                  <p className="mt-1 break-words text-[14px] text-muted">
                    Ref <span className="font-mono text-ink/80">{r.reference}</span>
                    {details.map((d) => (
                      <span key={d}> · {d}</span>
                    ))}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-6 md:flex-col md:items-end md:gap-3">
                  <Badge tone={STATUS_TONE[r.status] ?? "outline"}>{LEAD_STATUS_LABEL[r.status] ?? r.status}</Badge>
                  {link && <TextLink href={link.href}>{link.label}</TextLink>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
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
  // Saved on the account; null until loaded.
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    let cancelled = false;
    myPreferencesAction()
      .then((res) => {
        if (!cancelled) setPrefs(res.ok ? res.preferences : DEFAULT_PREFERENCES);
      })
      .catch(() => {
        if (!cancelled) setPrefs(DEFAULT_PREFERENCES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (next: UserPreferences, message: string, tone: "success" | "default") => {
    const before = prefs;
    setPrefs(next);
    const res = await savePreferencesAction(next).catch(() => ({ ok: false as const, error: undefined }));
    if (res.ok) toast(message, { tone });
    else {
      setPrefs(before);
      toast("Couldn't save your preferences. Please try again.", { tone: "error" });
    }
  };
  const alerts = prefs?.alerts ?? DEFAULT_PREFERENCES.alerts;
  const contact = prefs?.contact ?? DEFAULT_PREFERENCES.contact;

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
              disabled={!prefs}
              onChange={(on) => save({ alerts: { ...alerts, [a.key]: on }, contact }, `${a.label} ${on ? "turned on" : "turned off"}`, on ? "success" : "default")}
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
              if (prefs) save({ alerts, contact: v }, `We'll contact you by ${v === "call" ? "phone" : v === "whatsapp" ? "WhatsApp" : "email"}`, "success");
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border border-line p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Bell aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <p className="text-[13.5px] leading-relaxed text-muted">
            Want your data removed? Email us from your sign-in address and we&apos;ll delete your account, saved cars and enquiry history.
          </p>
        </div>
        <Button
          href="mailto:hello@marchgear.in?subject=Please%20delete%20my%20March%20Gear%20account"
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted hover:text-red"
        >
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
          <p className="type-lead mt-5 max-w-lg text-muted">Your saved cars on every device, and every enquiry and booking you make — with its latest status — in one place.</p>
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
              { icon: History, title: "Your requests", body: "Track bookings and quotes." },
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
