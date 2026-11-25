"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

const noop = () => () => {};

/** True only after hydration — safe guard for portals. */
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/** Open dialogs, newest last — only the top one answers Escape and traps Tab (a modal opened from a drawer). */
const dialogStack: symbol[] = [];
let headingIds = 0;

/** Escape-to-close, scroll lock, focus capture/restore and a simple focus trap. */
export function useDialogBehaviour(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const token = Symbol("dialog");
    dialogStack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      // A dialog without a label is named by its first heading.
      if (panel && !panel.hasAttribute("aria-label") && !panel.hasAttribute("aria-labelledby")) {
        const heading = panel.querySelector<HTMLElement>("h1, h2, h3");
        if (heading) {
          heading.id ||= `dialog-heading-${++headingIds}`;
          panel.setAttribute("aria-labelledby", heading.id);
        }
      }
      const target = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
      target?.focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      // Focus on the panel itself (just opened) or somewhere outside it also wraps around.
      const loose = active === panel || !panel.contains(active);
      if (e.shiftKey && (active === first || loose)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || (loose && active !== panel))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      const i = dialogStack.indexOf(token);
      if (i >= 0) dialogStack.splice(i, 1);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, panelRef]);
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Hide the default header (render your own) */
  bare?: boolean;
  labelledBy?: string;
}

const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

/** Centered dialog on desktop, bottom sheet on mobile. */
export function Modal({ open, onClose, title, description, children, size = "md", className, bare, labelledBy }: ModalProps) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehaviour(open, onClose, panelRef);
  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            aria-labelledby={labelledBy}
            tabIndex={-1}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.45, ease: EASE }}
            className={cn(
              "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[6px] bg-white shadow-lift outline-none sm:rounded-[4px]",
              widths[size],
              className,
            )}
          >
            {!bare && (
              <div className="flex items-start justify-between gap-6 border-b border-line px-6 py-5 sm:px-8">
                <div>
                  {title && <h2 className="type-h3">{title}</h2>}
                  {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist"
                >
                  <X className="size-5" />
                </button>
              </div>
            )}
            <div className="overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Side drawer (right) on desktop; full-height on mobile. Use side="bottom" for mobile filter sheets. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "bottom" | "left";
  className?: string;
}) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehaviour(open, onClose, panelRef);
  if (!isClient) return null;

  const from = side === "bottom" ? { y: "100%" } : side === "left" ? { x: "-100%" } : { x: "100%" };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            tabIndex={-1}
            initial={from}
            animate={{ x: 0, y: 0 }}
            exit={from}
            transition={{ duration: 0.45, ease: EASE }}
            className={cn(
              "absolute flex flex-col bg-white shadow-lift outline-none",
              side === "right" && "inset-y-0 right-0 w-full max-w-md",
              side === "left" && "inset-y-0 left-0 w-full max-w-md",
              side === "bottom" && "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[8px]",
              className,
            )}
          >
            {title !== undefined && (
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="type-h4">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-2 inline-flex size-9 items-center justify-center rounded-full hover:bg-mist"
                >
                  <X className="size-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {footer && <div className="border-t border-line p-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
