const LAKH = 100_000;
const CRORE = 10_000_000;

function trim(value: number, digits = 2) {
  return Number(value.toFixed(digits)).toString();
}

/** ₹11.11 Lakh / ₹1.25 Cr */
export function formatPrice(amount: number) {
  if (amount >= CRORE) return `₹${trim(amount / CRORE)} Cr`;
  if (amount >= LAKH) return `₹${trim(amount / LAKH)} Lakh`;
  return formatINR(amount);
}

/** ₹11.11 L / ₹1.25 Cr — for dense UI */
export function formatPriceShort(amount: number) {
  if (amount >= CRORE) return `₹${trim(amount / CRORE)} Cr`;
  if (amount >= LAKH) return `₹${trim(amount / LAKH)} L`;
  return formatINR(amount);
}

/** ₹11.11 – 20.50 Lakh, or ₹95 Lakh – 1.2 Cr when units differ */
export function formatPriceRange(min: number, max: number) {
  if (min === max) return formatPrice(min);
  const unit = (n: number) => (n >= CRORE ? "Cr" : "Lakh");
  const value = (n: number) => trim(n >= CRORE ? n / CRORE : n / LAKH);
  if (unit(min) === unit(max)) return `₹${value(min)} – ${value(max)} ${unit(max)}`;
  return `₹${value(min)} ${unit(min)} – ${value(max)} ${unit(max)}`;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹11,11,000 */
export function formatINR(amount: number) {
  return inr.format(Math.round(amount));
}

const plain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatNumber(value: number) {
  return plain.format(value);
}

export function formatKm(value: number) {
  return `${plain.format(value)} km`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 2026-11-04 → 4 Nov 2026 (string-based so server and client always agree) */
export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** 2027-02 → Feb 2027 */
export function formatMonth(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
