import type { FieldErrors, Section, WizardApplication } from "@/partner/schemas";

/** What every wizard step receives from <Wizard>. */
export interface StepProps<S extends Section> {
  app: WizardApplication;
  value: WizardApplication[S];
  onChange: (value: WizardApplication[S]) => void;
  errors: FieldErrors;
  /** Clears these error keys (and their nested keys). */
  clear: (...keys: string[]) => void;
}

/** A client-side key for new rows (showrooms). Called from event handlers only. */
export const newKey = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
