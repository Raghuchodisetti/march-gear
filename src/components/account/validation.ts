/** Shared form rules for sign-in, registration and profile editing. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Indian mobile numbers: 10 digits, starting 6–9. */
export const MOBILE_RE = /^[6-9]\d{9}$/;

/** 9876543210 → "+91 98765 43210" */
export const prettyMobile = (digits: string) => `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

/** "+91 98765 43210" → "9876543210" */
export const mobileDigits = (phone: string) => phone.replace(/\D/g, "").slice(-10);

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Placeholder name for members who signed in by OTP and haven't added one. */
export const DEFAULT_MEMBER_NAME = "March Gear Member";

/** First name for greetings, or null when the member hasn't set a real name. */
export const greetingName = (name: string) => (name === DEFAULT_MEMBER_NAME ? null : firstName(name));
