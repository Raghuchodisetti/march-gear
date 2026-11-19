import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, tone = "dark", className }: { children: ReactNode; tone?: "dark" | "light"; className?: string }) {
  return (
    <p
      className={cn(
        "type-eyebrow inline-flex items-center gap-3",
        tone === "dark" ? "text-ink" : "text-white",
        className,
      )}
    >
      <span aria-hidden className="h-px w-6 bg-red" />
      {children}
    </p>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: { label: string; href: string };
  tone?: "dark" | "light";
  align?: "left" | "split";
  className?: string;
  children?: ReactNode;
}

/**
 * Standard section opener. "split" places the description/action on the right
 * at large sizes, which suits wide editorial sections.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  tone = "dark",
  align = "split",
  className,
  children,
}: SectionHeadingProps) {
  const light = tone === "light";
  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        align === "split" && "lg:flex-row lg:items-end lg:justify-between lg:gap-16",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
        <h2 className={cn("type-h2 mt-5 text-balance", light ? "text-white" : "text-ink")}>{title}</h2>
      </div>
      {(description || action || children) && (
        <div className={cn("flex max-w-md flex-col gap-5", align === "split" && "lg:items-end lg:text-right")}>
          {description && (
            <p className={cn("text-[15px] leading-relaxed text-pretty", light ? "text-white/65" : "text-muted")}>{description}</p>
          )}
          {action && <TextLink href={action.href} tone={tone}>{action.label}</TextLink>}
          {children}
        </div>
      )}
    </div>
  );
}

export function TextLink({
  href,
  children,
  tone = "dark",
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/tl inline-flex items-center gap-1.5 text-sm font-medium",
        tone === "dark" ? "text-ink" : "text-white",
        className,
      )}
    >
      <span className="relative">
        {children}
        <span
          aria-hidden
          className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-100 bg-current transition-transform duration-[400ms] ease-[var(--ease-premium)] group-hover/tl:scale-x-0 group-hover/tl:origin-right"
        />
      </span>
      <ArrowUpRight className="size-4 text-red transition-transform duration-[250ms] group-hover/tl:-translate-y-0.5 group-hover/tl:translate-x-0.5" aria-hidden />
    </Link>
  );
}
