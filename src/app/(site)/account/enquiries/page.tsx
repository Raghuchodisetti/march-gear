import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_TYPE_LABEL } from "@/lib/leads";
import type { LeadType } from "@/db/enums";
import { requireUser } from "@/server/auth";
import { getCustomerEnquiries } from "@/server/customer/requests";
import { FilterForm, FilterSelect, Pagination, PortalHeader, SearchInput, hrefWith, pageParam, strParam } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { EnquiryList } from "@/components/customer/enquiries/enquiry-list";

export const metadata: Metadata = { title: "Enquiries" };

const PAGE = 15;
const BASE = "/account/enquiries";

export default async function EnquiriesPage({ searchParams }: PageProps<"/account/enquiries">) {
  const user = await requireUser(BASE);
  const sp = await searchParams;
  const all = await getCustomerEnquiries(user.id);

  const q = strParam(sp.q)?.slice(0, 80);
  const typeP = strParam(sp.type);
  const types = [...new Set(all.map((e) => e.type))];
  const type = types.includes(typeP as LeadType) ? (typeP as LeadType) : undefined;
  const stateP = strParam(sp.state);
  const state = stateP === "open" || stateP === "closed" || stateP === "dealer" ? stateP : undefined;
  const page = pageParam(sp.page);

  const needle = q?.toLowerCase();
  const filtered = all.filter(
    (e) =>
      (!type || e.type === type) &&
      (!state || (state === "open" ? e.open : state === "closed" ? !e.open : Boolean(e.dealerName))) &&
      (!needle || e.reference.toLowerCase().includes(needle) || e.title.toLowerCase().includes(needle) || (e.dealerName ?? "").toLowerCase().includes(needle)),
  );
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const params = { q, type, state };
  const hasFilters = Boolean(q || type || state);

  const tiles = [
    { key: "open", label: "Open", value: all.filter((e) => e.open).length },
    { key: "dealer", label: "With a dealer", value: all.filter((e) => e.dealerName).length },
    { key: "closed", label: "Closed", value: all.filter((e) => !e.open).length },
  ] as const;

  return (
    <>
      <PortalHeader
        title="Enquiries"
        description="Every request you've sent on MarchGear — who's handling it and how far it has got."
        actions={
          <Button href="/new-cars" variant="outline" size="sm">
            Browse cars
          </Button>
        }
      />

      {all.length === 0 ? (
        <div className="flex flex-col items-center border border-dashed border-ink/15 bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <Inbox aria-hidden className="size-5 text-ink/60" />
          </span>
          <p className="mt-4 text-[16px] font-semibold">No enquiries yet</p>
          <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted">
            Ask for a test drive, the best price or a callback while you&apos;re signed in, and it shows up here with the dealer&apos;s progress.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button href="/new-cars" variant="dark" size="sm">
              Browse new cars
            </Button>
            <Button href="/dealers" variant="outline" size="sm">
              Find a dealer
            </Button>
          </div>
        </div>
      ) : (
        <>
          <nav aria-label="Quick filters" className="mb-4 grid grid-cols-3 divide-x divide-line border border-line bg-white">
            {tiles.map((t) => {
              const on = state === t.key;
              return (
                <Link
                  key={t.key}
                  href={hrefWith(BASE, params, { state: on ? undefined : t.key, page: undefined })}
                  aria-current={on ? "true" : undefined}
                  className={cn("relative px-4 py-4 transition-colors duration-300 md:px-5", on ? "bg-ink text-white" : "hover:bg-mist/50")}
                >
                  <span className={cn("block text-[12px] font-medium", on ? "text-white/70" : "text-muted")}>{t.label}</span>
                  <span className="mt-1.5 block font-display text-[24px] font-semibold leading-none tracking-[-0.03em] num md:text-[28px]">{t.value}</span>
                </Link>
              );
            })}
          </nav>

          <FilterForm resetHref={BASE} hasFilters={hasFilters}>
            <SearchInput value={q} placeholder="Reference, car or dealer" />
            <FilterSelect name="type" value={type} label="All request types" options={types.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))} />
            <FilterSelect
              name="state"
              value={state}
              label="Open and closed"
              options={[
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
                { value: "dealer", label: "With a dealer" },
              ]}
            />
          </FilterForm>

          <EnquiryList
            items={rows}
            empty={
              <div className="px-5 py-14 text-center">
                <p className="text-[14.5px] font-semibold">Nothing matches these filters</p>
                <p className="mt-1 text-[13px] text-muted">Try another reference or car name.</p>
                <Link href={BASE} className="mt-4 inline-flex text-[13px] font-medium text-ink underline-offset-4 hover:underline">
                  Show all enquiries
                </Link>
              </div>
            }
          />
          {filtered.length > PAGE && <Pagination base={BASE} params={params} page={page} pageSize={PAGE} total={filtered.length} />}
        </>
      )}

      <p className="mt-6 max-w-2xl text-[12px] leading-relaxed text-muted">
        Only requests you sent while signed in to this account appear here. Requests sent as a guest can&apos;t be added later — we never match them to you by phone number or email.
      </p>
    </>
  );
}
