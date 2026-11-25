import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { Building2, ExternalLink } from "lucide-react";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
  LEAD_TYPE_LABEL,
} from "@/lib/leads";
import { ACCOUNT_KINDS } from "@/lib/accounts";
import { isSection } from "@/lib/staff-access";
import { deleteUserAction } from "@/server/actions/admin";
import { getUserDetail, type SavedState } from "@/server/admin/audience";
import { getDeskUser } from "@/server/auth";
import {
  AdminHeader,
  Badge,
  Panel,
  formatDateTime,
  type BadgeTone,
} from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/delete-button";
import {
  SignOutEverywhereButton,
  StaffAccessEditor,
  UserEditor,
} from "@/components/admin/user-forms";
import type { UserRole } from "@/db/enums";

/* One account's page — customers, dealer logins, vendor logins and staff each open it from their own list
   (and only whoever manages that kind of account can). */

const SAVED_STATE: Record<SavedState, { label: string; tone: BadgeTone }> = {
  live: { label: "Listed", tone: "green" },
  draft: { label: "Draft", tone: "neutral" },
  hidden: { label: "Brand hidden", tone: "neutral" },
  reserved: { label: "Reserved", tone: "amber" },
  sold: { label: "Sold", tone: "neutral" },
  gone: { label: "Removed", tone: "red" },
};

/** "Edge on Windows" from a user-agent string — a hint for staff, not a security signal. */
function describeAgent(ua: string | null) {
  if (!ua) return "Unknown browser";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (!browser && !os) return ua.length > 48 ? `${ua.slice(0, 47)}…` : ua;
  return [browser ?? "Browser", os && `on ${os}`].filter(Boolean).join(" ");
}

export async function AccountDetail({
  id,
  kinds,
}: {
  id: string;
  kinds: readonly UserRole[];
}) {
  const data = /^\d+$/.test(id) ? await getUserDetail(Number(id)) : null;
  // Each list only opens its own kind of account.
  if (!data || !kinds.includes(data.user.role)) notFound();
  const { user, org, leads, saved, sessions } = data;
  const me = await getDeskUser();
  const self = me?.id === user.id;
  const kind = ACCOUNT_KINDS[user.role];
  const desk = user.role === "staff" || user.role === "admin";

  return (
    <>
      <AdminHeader
        back={{ href: kind.list, label: kind.listLabel }}
        title={user.name}
        description={`${kind.label} · joined ${formatDateTime(user.createdAt)} · ${user.lastLoginAt ? `last signed in ${formatDateTime(user.lastLoginAt)}` : "never signed in"}${user.role === "customer" ? ` · ${saved.length} saved ${saved.length === 1 ? "car" : "cars"}` : ""}`}
        actions={
          !self && (
            <DeleteButton
              action={deleteUserAction.bind(null, user.id)}
              confirmText={`Delete ${user.name}'s account?${user.role === "customer" ? " Their leads are kept." : ""}`}
              redirectTo={kind.list}
            />
          )
        }
      />
      {desk && (
        <div className="mb-6">
          <StaffAccessEditor
            user={{
              id: user.id,
              name: user.name,
              role: user.role as "staff" | "admin",
              permissions: (user.permissions ?? []).filter(isSection),
            }}
            self={self}
          />
        </div>
      )}
      {org && (
        <Panel
          title={user.role === "dealer" ? "Dealership" : "Insurance vendor"}
          className="mb-6"
        >
          <Link
            href={org.href}
            className="group inline-flex items-center gap-3"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-mist">
              <Building2 aria-hidden className="size-5" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold group-hover:text-red">
                {org.name}
              </span>
              <span className="block text-[12.5px] capitalize text-muted">
                {org.memberRole}
              </span>
            </span>
          </Link>
        </Panel>
      )}
      <UserEditor user={user} />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {user.role === "customer" && (
          <Panel title={`Saved cars (${saved.length})`} padded={false}>
            {saved.length === 0 ? (
              <p className="p-5 text-[13.5px] text-muted">
                Nothing saved to this account.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {saved.map((item) => {
                  const st = SAVED_STATE[item.state];
                  const title =
                    item.title ??
                    (item.kind === "cars"
                      ? `New car “${item.itemId}”`
                      : `Used listing ${item.itemId}`);
                  return (
                    <li
                      key={`${item.kind}:${item.itemId}`}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <span className="min-w-0">
                        {item.href ? (
                          <Link
                            href={item.href}
                            target="_blank"
                            className="inline-flex max-w-full items-center gap-1.5 text-[14px] font-medium hover:text-red"
                          >
                            <span className="truncate">{title}</span>{" "}
                            <ExternalLink
                              aria-hidden
                              className="size-3.5 shrink-0"
                            />
                          </Link>
                        ) : (
                          <span
                            className={
                              item.state === "gone"
                                ? "block truncate text-[14px] text-muted"
                                : "block truncate text-[14px] font-medium"
                            }
                          >
                            {title}
                          </span>
                        )}
                        <span className="block text-[12.5px] text-muted">
                          {item.kind === "cars" ? "New car" : "Used car"} ·
                          saved {formatDateTime(item.savedAt)}
                          {item.state === "gone" &&
                            " · no longer in the catalogue"}
                        </span>
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        <Panel
          title={`Signed in on (${sessions.length})`}
          padded={false}
          action={
            <SignOutEverywhereButton
              userId={user.id}
              name={user.name}
              self={self}
              count={sessions.length}
            />
          }
        >
          {sessions.length === 0 ? (
            <p className="p-5 text-[13.5px] text-muted">
              No active sessions — this account isn&apos;t signed in anywhere.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {sessions.map((s, i) => (
                <li key={i} className="px-5 py-3">
                  <p
                    className="flex flex-wrap items-center gap-2 text-[14px] font-medium"
                    title={s.userAgent ?? undefined}
                  >
                    {describeAgent(s.userAgent)}
                    {s.current && <Badge tone="green">This browser</Badge>}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    Signed in {formatDateTime(s.createdAt)} · expires{" "}
                    {formatDateTime(s.expiresAt)}
                    {s.ip && <> · IP {s.ip}</>}
                  </p>
                  {s.userAgent && (
                    <p className="mt-0.5 truncate text-[11.5px] text-muted">
                      {s.userAgent}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {user.role === "customer" && (
        <Panel
          title={`Requests (${leads.length})`}
          className="mt-6"
          padded={false}
        >
          {leads.length === 0 ? (
            <p className="p-5 text-[13.5px] text-muted">
              No enquiries or bookings from this account.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {leads.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/admin/leads/${l.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-mist/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">
                        {LEAD_TYPE_LABEL[l.type]}{" "}
                        <span className="font-normal text-muted">
                          · {l.subject ?? l.reference}
                        </span>
                      </span>
                      <span className="text-[12.5px] text-muted">
                        {formatDateTime(l.createdAt)}
                      </span>
                    </span>
                    <Badge tone={LEAD_STATUS_TONE[l.status]}>
                      {LEAD_STATUS_LABEL[l.status]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  );
}
