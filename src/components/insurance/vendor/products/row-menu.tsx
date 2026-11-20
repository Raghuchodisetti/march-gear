"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/* A row's "⋯" menu, portalled so a table's overflow never clips it. Keyboard: arrows, Escape. */

export type MenuItem = { label: string; icon: ReactNode; onSelect?: () => void; href?: string; external?: boolean; tone?: "danger"; disabled?: boolean } | "divider";

export function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const width = 232;
      const height = menu.current?.offsetHeight ?? 320;
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      setPos(r.bottom + height + 12 > window.innerHeight && r.top > height + 12 ? { bottom: window.innerHeight - r.top + 6, left } : { top: r.bottom + 6, left });
    };
    place();
    const close = () => setOpen(false);
    const outside = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btn.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const nodes = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? []);
        const i = nodes.indexOf(document.activeElement as HTMLElement);
        nodes[(i + (e.key === "ArrowDown" ? 1 : -1) + nodes.length) % nodes.length]?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus());
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] outline-none transition-colors hover:bg-mist focus-visible:bg-mist disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${label}`}
        className="inline-flex size-9 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-mist hover:text-ink"
      >
        <MoreHorizontal className="size-[18px]" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={`Actions for ${label}`}
            style={{ position: "fixed", width: 232, visibility: pos ? "visible" : "hidden", ...pos }}
            className="z-[90] overflow-hidden rounded-[4px] border border-line bg-white py-1.5 shadow-lift"
          >
            {items.map((it, i) =>
              it === "divider" ? (
                <div key={`d${i}`} role="separator" className="my-1.5 h-px bg-line" />
              ) : it.href ? (
                <Link key={it.label} role="menuitem" href={it.href} {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} onClick={() => setOpen(false)} className={item}>
                  <span className="text-muted">{it.icon}</span>
                  {it.label}
                </Link>
              ) : (
                <button
                  key={it.label}
                  role="menuitem"
                  type="button"
                  disabled={it.disabled}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect?.();
                  }}
                  className={cn(item, it.tone === "danger" && "text-red")}
                >
                  <span className={it.tone === "danger" ? "text-red" : "text-muted"}>{it.icon}</span>
                  {it.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
