/** Monthly instalment for a reducing-balance loan. */
export function calculateEmi(principal: number, annualRatePct: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const factor = Math.pow(1 + r, months);
  return (principal * r * factor) / (factor - 1);
}

export function loanBreakdown(principal: number, annualRatePct: number, months: number) {
  const emi = calculateEmi(principal, annualRatePct, months);
  const totalPayable = emi * months;
  return {
    emi,
    totalPayable,
    totalInterest: Math.max(0, totalPayable - principal),
  };
}

/** Maximum loan a given monthly EMI can service. */
export function principalForEmi(emi: number, annualRatePct: number, months: number) {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return emi * months;
  const factor = Math.pow(1 + r, months);
  return (emi * (factor - 1)) / (r * factor);
}
