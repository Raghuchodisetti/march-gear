/** What every Server Action returns, so forms can show field errors consistently. */
export type ActionFailure = { ok: false; error?: string; fieldErrors?: Record<string, string> };

export type ActionResult<T extends object = object> = ({ ok: true } & T) | ActionFailure;

/** The signed-in account as the browser sees it. */
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  state: string | null;
  city: string | null;
  role: "customer" | "staff" | "admin" | "dealer" | "insurer";
  memberSince: string;
}

/** What a customer has asked us to contact them about, and how. */
export interface UserPreferences {
  alerts: { price: boolean; launch: boolean; digest: boolean; whatsapp: boolean };
  contact: "call" | "whatsapp" | "email";
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  alerts: { price: true, launch: true, digest: false, whatsapp: false },
  contact: "whatsapp",
};

export interface WishlistData {
  cars: string[];
  used: string[];
}
