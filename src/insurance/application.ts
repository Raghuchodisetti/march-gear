import type { InsurerApplication } from "./types";

/* The vendor registration wizard: steps and the empty draft. Client-safe. */

export const INS_STEPS = [
  { n: 1, key: "contact", title: "Contact details", blurb: "Who we'll talk to, with mobile and email verification." },
  { n: 2, key: "company", title: "Company details", blurb: "Legal name, business type and registered address." },
  { n: 3, key: "registration", title: "Business registration", blurb: "GSTIN, PAN, CIN and date of establishment." },
  { n: 4, key: "regulatory", title: "Regulatory details", blurb: "Your category, registration, licence and authorised representative." },
  { n: 5, key: "branches", title: "Branch offices", blurb: "Offices customers and MarchGear can reach." },
  { n: 6, key: "bank", title: "Banking details", blurb: "For refunds and settlements. Stored encrypted." },
  { n: 7, key: "documents", title: "Documents & submission", blurb: "Upload documents, review and submit." },
] as const;

export type InsStepKey = (typeof INS_STEPS)[number]["key"];

export const emptyInsurerApplication = (seed: { name?: string; email?: string; mobile?: string } = {}): InsurerApplication => ({
  contact: { name: seed.name ?? "", designation: "", mobile: seed.mobile ?? "", mobileVerified: false, email: seed.email ?? "", emailVerified: false },
  company: { legalName: "", brandName: "", businessType: "", website: "", address: "", city: "", state: "", pin: "" },
  registration: { gstin: "", pan: "", cin: "", establishedOn: "" },
  regulatory: {
    category: "",
    registrationType: "",
    licenceNumber: "",
    licenceValidUntil: "",
    representative: { name: "", designation: "", mobile: "", email: "" },
    documents: [],
  },
  branches: [],
  bank: { holder: "", bankName: "", accountNumber: "", accountMasked: "", ifsc: "", proof: null },
  documents: {
    businessRegistration: null,
    gst: null,
    pan: null,
    regulatory: null,
    addressProof: null,
    representativeId: null,
    representativeAuthorisation: null,
    supporting: [],
  },
  declaration: { accepted: false, name: "", acceptedAt: null },
});

/** Required documents on step 7, in display order. */
export const INS_REQUIRED_DOCUMENTS: { key: Exclude<keyof InsurerApplication["documents"], "supporting">; kind: string; label: string }[] = [
  { key: "businessRegistration", kind: "business_registration", label: "Business registration certificate" },
  { key: "gst", kind: "gst", label: "GST certificate" },
  { key: "pan", kind: "pan", label: "Company PAN" },
  { key: "regulatory", kind: "regulatory_licence", label: "Regulatory authorisation / licence" },
  { key: "addressProof", kind: "address_proof", label: "Registered address proof" },
  { key: "representativeId", kind: "representative_id", label: "Authorised representative's ID proof" },
  { key: "representativeAuthorisation", kind: "representative_authorisation", label: "Board resolution / authorisation letter for the representative" },
];
