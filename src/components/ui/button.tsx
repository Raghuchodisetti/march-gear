import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "dark" | "outline" | "ghost" | "light" | "outline-light" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[-0.005em] transition-[background-color,color,border-color,box-shadow,transform] duration-[250ms] ease-[var(--ease-premium)] disabled:pointer-events-none disabled:opacity-40 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-red text-white hover:bg-red-600 active:translate-y-px",
  dark: "bg-ink text-white hover:bg-ink-3 active:translate-y-px",
  outline: "border border-ink/15 bg-transparent text-ink hover:border-ink hover:bg-ink hover:text-white",
  ghost: "bg-transparent text-ink hover:bg-mist",
  light: "bg-white text-ink hover:bg-white/90 active:translate-y-px",
  "outline-light": "border border-white/30 bg-transparent text-white hover:border-white hover:bg-white hover:text-ink",
  link: "h-auto px-0 text-ink underline-offset-[6px] hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "h-9 rounded-[3px] px-3.5 text-[13px]",
  md: "h-11 rounded-[3px] px-5 text-sm",
  lg: "h-13 rounded-[3px] px-7 text-[15px]",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  /** Adds a trailing arrow that nudges on hover */
  arrow?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

type ButtonAsButton = CommonProps & Omit<ComponentProps<"button">, keyof CommonProps> & { href?: undefined };
type ButtonAsLink = CommonProps & Omit<ComponentProps<typeof Link>, keyof CommonProps> & { href: string };

export function buttonClasses({ variant = "primary", size = "md", className }: Pick<CommonProps, "variant" | "size" | "className">) {
  return cn(base, variants[variant], variant !== "link" && sizes[size], className);
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", arrow, icon, className, children, ...rest } = props;
  const content = (
    <>
      {icon}
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform duration-[250ms] ease-[var(--ease-premium)] group-hover/btn:translate-x-0.5"
        />
      )}
    </>
  );
  const classes = buttonClasses({ variant, size, className });

  if ("href" in rest && rest.href !== undefined) {
    return (
      <Link {...(rest as ComponentProps<typeof Link>)} className={classes}>
        {content}
      </Link>
    );
  }
  const { type = "button", ...buttonRest } = rest as ComponentProps<"button">;
  return (
    <button type={type} {...buttonRest} className={classes}>
      {content}
    </button>
  );
}

/** Circular icon-only button. Always pass an aria-label. */
export function IconButton({
  className,
  tone = "light",
  size = "md",
  ...props
}: ComponentProps<"button"> & { tone?: "light" | "dark" | "glass" | "plain"; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,border-color,transform] duration-[250ms] ease-[var(--ease-premium)] disabled:pointer-events-none disabled:opacity-30",
        size === "md" ? "size-10" : "size-8",
        tone === "light" && "border border-line bg-white text-ink hover:border-ink",
        tone === "dark" && "bg-ink text-white hover:bg-ink-3",
        tone === "glass" && "bg-white/90 text-ink backdrop-blur-sm hover:bg-white",
        tone === "plain" && "text-current hover:bg-ink/5",
        className,
      )}
    />
  );
}
