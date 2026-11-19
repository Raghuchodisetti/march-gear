import type { Metadata } from "next";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmiPlanner } from "@/components/tools/emi-planner";
import { amortise } from "@/components/tools/calc";
import { HowItWorks, RelatedTools, ToolDisclaimer, ToolFaqs, ToolMetaRow, ToolTips } from "@/components/tools/tool-sections";

export const metadata: Metadata = {
  title: "Car EMI Calculator",
  description:
    "Calculate your car loan EMI instantly. Adjust price, down payment, interest rate and tenure, quick-pick popular cars, and see a year-by-year principal vs interest schedule.",
};

// Worked example for the tenure tip, from the same model as the calculator.
const five = amortise(960_000, 9.25, 5);
const seven = amortise(960_000, 9.25, 7);

export default function EmiCalculatorPage() {
  return (
    <>
      <PageHeader
        eyebrow="EMI Calculator"
        crumbs={[{ label: "Tools", href: "/tools" }, { label: "EMI Calculator" }]}
        title={
          <>
            Your car EMI, <span className="type-editorial">to the rupee</span>
          </>
        }
        description="Set the price, down payment, rate and tenure — or start from a popular car — and see the monthly instalment, total interest and how every payment splits over the life of the loan."
      >
        <ToolMetaRow items={["Live results", "Monthly reducing balance", "Year-by-year schedule", "Illustrative estimate"]} />
      </PageHeader>

      <EmiPlanner />

      <ToolTips
        eyebrow="Before you sign"
        title={
          <>
            Four habits of <span className="type-editorial">well-financed</span> buyers
          </>
        }
        tips={[
          {
            title: "Work to the 20/4/10 rule",
            body: "Put at least 20% down, keep the tenure to four years or less, and hold EMI plus running costs under 10% of gross monthly income. It keeps you ahead of depreciation.",
          },
          {
            title: "Compare the APR, not the headline rate",
            body: "Processing fees of 0.5–2%, documentation charges and bundled insurance can add a full point to the effective rate. Ask every lender for the all-in cost.",
          },
          {
            title: "Check prepayment terms early",
            body: "Fixed-rate car loans often carry foreclosure charges of 2–6% of the outstanding balance. If you expect a bonus, negotiate part-prepayment rights before you sign.",
          },
          {
            title: "Shorter tenure, smaller total",
            body: (
              <>
                On a {formatINR(960_000)} loan at 9.25%, stretching from five to seven years cuts the EMI from {formatINR(five.emi)} to{" "}
                {formatINR(seven.emi)} — but adds {formatINR(seven.totalInterest - five.totalInterest)} in interest.
              </>
            ),
          },
        ]}
      />

      <HowItWorks
        intro="Car loans in India are almost always reducing-balance loans: interest is charged each month only on what you still owe."
        steps={[
          { title: "Loan amount", body: "The price you finance, less your down payment.", formula: "P = car price − down payment" },
          { title: "Monthly rate", body: "The annual rate the lender quotes, converted to a monthly fraction.", formula: "r = annual rate ÷ 12 ÷ 100" },
          {
            title: "The EMI",
            body: "A fixed instalment that repays the loan exactly over n months.",
            formula: "EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)",
          },
          {
            title: "The schedule",
            body: "Each month, interest is charged on the outstanding balance and the rest of the EMI reduces it. We total those months by year.",
            formula: "interest = balance × r  ·  principal = EMI − interest",
          },
        ]}
      />

      <ToolFaqs
        items={[
          {
            q: "What exactly is an EMI?",
            a: "An equated monthly instalment is the fixed amount you pay your lender every month. It covers that month's interest plus a slice of the original loan, so the loan is fully repaid by the end of the tenure.",
          },
          {
            q: "Should I finance the on-road or ex-showroom price?",
            a: "Most banks fund up to 80–90% of the on-road price for new cars, and some offer 100% of ex-showroom. Financing less — and paying registration and insurance upfront — keeps both the EMI and the total interest lower.",
          },
          {
            q: "Fixed or floating rate — which is better?",
            a: "Fixed rates give a predictable EMI and suit most car loans, which are short. Floating rates can be cheaper when rates fall and usually carry no foreclosure penalty, but your EMI or tenure can rise if rates go up.",
          },
          {
            q: "Can I pay off my car loan early?",
            a: "Usually, yes. Many lenders allow part-prepayment after 6–12 EMIs and full foreclosure with a charge on fixed-rate loans. Prepaying early in the tenure saves the most interest, because that's when interest makes up most of each EMI.",
          },
          {
            q: "Why does my dealer's EMI differ from this one?",
            a: "Dealer quotes may include processing fees, insurance, extended warranty or accessories in the loan, or use a different rate for your credit profile. Use this as a benchmark and ask for an itemised loan sheet.",
          },
        ]}
      />

      <RelatedTools current="emi-calculator" slugs={["car-loan", "ownership-cost", "ev-vs-petrol"]} />
      <ToolDisclaimer>
        EMIs are computed on a monthly reducing balance from the inputs you choose and indicative ex-showroom prices. They are not a loan offer — the
        rate, fees and amount you&apos;re offered depend on the lender and your credit profile.
      </ToolDisclaimer>
    </>
  );
}
