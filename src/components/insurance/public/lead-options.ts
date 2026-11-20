/* Options for the insurance callback forms — shared by the forms and src/server/actions/insurance-leads.ts. Client-safe. */

export const CLAIM_KINDS = ["accident", "theft", "third_party", "natural", "fire", "other"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];
export const CLAIM_KIND_LABEL: Record<ClaimKind, string> = {
  accident: "Accident damage",
  theft: "Theft of the car",
  third_party: "Someone is claiming against me",
  natural: "Flood or natural calamity",
  fire: "Fire",
  other: "Something else",
};

export const CAR_WHERE = ["at_spot", "at_garage", "at_home", "stolen"] as const;
export type CarWhere = (typeof CAR_WHERE)[number];
export const CAR_WHERE_LABEL: Record<CarWhere, string> = {
  at_spot: "Still at the spot",
  at_garage: "At a garage",
  at_home: "At home / parked",
  stolen: "Stolen — not with me",
};

export const HELP_TOPICS = ["new", "renewal", "compare", "addons", "claim", "other"] as const;
export type HelpTopic = (typeof HELP_TOPICS)[number];
export const HELP_TOPIC_LABEL: Record<HelpTopic, string> = {
  new: "Buying a new policy",
  renewal: "Renewing my policy",
  compare: "Comparing plans",
  addons: "Choosing add-ons",
  claim: "Understanding a claim",
  other: "Something else",
};

export const CALL_TIMES = ["morning", "afternoon", "evening", "anytime"] as const;
export type CallTime = (typeof CALL_TIMES)[number];
export const CALL_TIME_LABEL: Record<CallTime, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  anytime: "Any time",
};
