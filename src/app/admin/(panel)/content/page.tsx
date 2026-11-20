import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BLOCKS, BLOCK_KEYS } from "@/content/registry";
import type { BlockGroup } from "@/content/define";
import { contentMeta } from "@/server/admin/content";
import { AdminHeader, Badge, formatDateTime } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Site content" };

const GROUP_ORDER: BlockGroup[] = ["Site", "Home", "Pages", "PDI", "Pricing & tools", "Insurance", "Editorial", "Legal"];

export default async function ContentAdminPage() {
  const meta = await contentMeta();
  const groups = GROUP_ORDER.map((g) => ({ group: g, keys: BLOCK_KEYS.filter((k) => BLOCKS[k].group === g) })).filter((g) => g.keys.length);

  return (
    <>
      <AdminHeader title="Site content" description="Copy, prices and settings used across the website. Changes go live as soon as you save." />
      <div className="space-y-8">
        {groups.map(({ group, keys }) => (
          <section key={group}>
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{group}</h2>
            <ul className="divide-y divide-line border border-line bg-white">
              {keys.map((key) => {
                const block = BLOCKS[key];
                const m = meta.get(key);
                const ready = block.sections.length > 0;
                return (
                  <li key={key}>
                    <Link href={`/admin/content/${key}`} className="flex items-center justify-between gap-6 px-5 py-4 transition-colors hover:bg-mist/50">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium">
                          {block.title}
                          {!ready ? <Badge tone="amber">Not editable yet</Badge> : m ? <Badge tone="blue">Customised</Badge> : <Badge>Default</Badge>}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-muted">{block.description}</span>
                        <span className="mt-1.5 block text-[12px] text-muted">
                          Used on: {block.usedOn.join(" · ")}
                          {m && ` · updated ${formatDateTime(m.updatedAt)}${m.updatedBy ? ` by ${m.updatedBy}` : ""}`}
                        </span>
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
