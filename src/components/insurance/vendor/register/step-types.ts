import type { FieldErrors, FileReview, InsSection, InsWizardApplication } from "@/insurance/schemas";

/** What every wizard step receives from <InsWizard>. */
export interface InsStepProps<S extends InsSection> {
  app: InsWizardApplication;
  value: InsWizardApplication[S];
  /** A new value, or an updater of the latest one (safe for several updates in one event). */
  onChange: (value: InsWizardApplication[S] | ((prev: InsWizardApplication[S]) => InsWizardApplication[S])) => void;
  errors: FieldErrors;
  /** Clears these error keys (and their nested keys). */
  clear: (...keys: string[]) => void;
  reviews: Record<number, FileReview>;
}

/** A client-side key for new rows (branches). Called from event handlers only. */
export const newKey = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
