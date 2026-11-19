/** Shared form rules for sign-in, registration and profile editing. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Indian mobile numbers: 10 digits, starting 6–9. */
export const MOBILE_RE = /^[6-9]\d{9}$/;

/** Same minimum the server enforces for passwords. */
export const MIN_PASSWORD = 8;

/** 9876543210 → "+91 98765 43210" */
export const prettyMobile = (digits: string) => `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

/** "+91 98765 43210" → "9876543210" */
export const mobileDigits = (phone: string) => phone.replace(/\D/g, "").slice(-10);

/** A stored mobile (10 digits, or an older "+91 …" value) for display; anything else is shown as-is. */
export const displayMobile = (phone: string) => {
  const digits = mobileDigits(phone);
  return digits.length === 10 ? prettyMobile(digits) : phone;
};

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Placeholder name for members who haven't added a real one. */
export const DEFAULT_MEMBER_NAME = "March Gear Member";

/** First name for greetings, or null when the member hasn't set a real name. */
export const greetingName = (name: string) => (name === DEFAULT_MEMBER_NAME ? null : firstName(name));
