import type { Metadata } from "next";
import { getCatalog } from "@/server/catalog";
import { calcRates } from "@/components/tools/calc";
import { PageHeader } from "@/components/ui/page-header";
import { LoanEligibility } from "@/components/tools/loan-eligibility";
import { HowItWorks, RelatedTools, ToolDisclaimer, ToolFaqs, ToolMetaRow } from "@/components/tools/tool-sections";
import { pageMetadata } from "@/components/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Car Loan Eligibility Calculator",
  description: "Find out how much car loan you could get from your monthly income and existing EMIs, and see every new car that fits the budget it gives you.",
  path: "/tools/car-loan",
});

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function CarLoanPage() {
  const { foir, loanToValue } = calcRates((await getCatalog()).content.toolRates);
  return (
    <>
      <PageHeader
        eyebrow="Car Loan Eligibility"
        crumbs={[{ label: "Tools", href: "/tools" }, { label: "Car Loan Eligibility" }]}
        title={
          <>
            How much can you <span className="type-editorial">borrow?</span>
          </>
        }
        description="Lenders cap your total EMIs at a share of take-home pay. Tell us your income and obligations to see the loan you're likely to qualify for — and the cars it puts within reach."
      >
        <ToolMetaRow items={["FOIR-based", `${pct(foir.salaried)} salaried · ${pct(foir["self-employed"])} self-employed`, "Matched to real models", "Illustrative estimate"]} />
      </PageHeader>

      <LoanEligibility />

      <HowItWorks
        intro="Indian lenders size car loans with a fixed obligation-to-income ratio (FOIR): the share of your net monthly income that may go to all EMIs combined."
        steps={[
          {
            title: "Apply the FOIR cap",
            body: `We cap total EMIs at ${pct(foir.salaried)} of take-home pay for salaried applicants and ${pct(foir["self-employed"])} for the self-employed, whose income lenders treat as more variable.`,
            formula: `EMI cap = net monthly income × ${foir.salaried} (or ${foir["self-employed"]})`,
          },
          {
            title: "Subtract existing EMIs",
            body: "Home, personal and two-wheeler loans and credit-card EMIs all count against the cap. What remains is the most a new car EMI can be.",
            formula: "max new EMI = EMI cap − existing EMIs",
          },
          {
            title: "Convert the EMI to a loan",
            body: "Working the EMI formula backwards at your rate and tenure gives the largest principal that EMI can repay.",
            formula: "loan = EMI × ((1 + r)ⁿ − 1) ÷ (r × (1 + r)ⁿ)",
          },
          {
            title: "Turn the loan into a car budget",
            body: `Most lenders fund around ${pct(loanToValue)} of the car's price, so we assume a ${pct(1 - loanToValue)} down payment and match models whose starting price fits.`,
            formula: `car budget = loan ÷ ${loanToValue}`,
          },
        ]}
      />

      <ToolFaqs
        items={[
          {
            q: "What is FOIR and why does it matter?",
            a: "FOIR — fixed obligation to income ratio — is the share of your monthly income already committed to EMIs. Lenders use it as a safety margin: the lower yours is, the more they're willing to lend and the better the rate you're likely to get.",
          },
          {
            q: "Does my credit score change the result?",
            a: "Yes. A CIBIL score above 750 typically unlocks the best rates and the full FOIR allowance. Lower scores can mean a higher rate, a lower loan-to-value or a requirement for a co-applicant.",
          },
          {
            q: "Can adding a co-applicant increase eligibility?",
            a: "Usually. Most banks let a spouse or parent with an income join the application, and combine both incomes (and both sets of EMIs) when applying the FOIR.",
          },
          {
            q: "Why are self-employed applicants capped lower?",
            a: "Business income fluctuates, so lenders apply a more conservative ratio and typically assess it from two to three years of income tax returns rather than monthly payslips.",
          },
          {
            q: "Is a longer tenure a good way to qualify for more?",
            a: "It raises the loan you can service, but you pay more interest and stay underwater on the car — owing more than it's worth — for longer. Treat seven years as a ceiling, not a target.",
          },
        ]}
      />

      <RelatedTools current="car-loan" slugs={["emi-calculator", "ownership-cost", "car-valuation"]} />
      <ToolDisclaimer>
        Eligibility is modelled with simplified FOIR caps and indicative ex-showroom prices. It is not a sanction or an offer of credit — lenders also
        consider credit history, employer, city and existing relationships.
      </ToolDisclaimer>
    </>
  );
}
