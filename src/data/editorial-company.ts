/* ──────────────────────────────────────────────────────────────
   Company content for /about and /contact. March Gear is a
   fictional demo brand; figures and offices are illustrative.
   ────────────────────────────────────────────────────────────── */

export const aboutStats: { value: number; decimals?: number; suffix?: string; prefix?: string; label: string; note: string }[] = [
  { value: 2.4, decimals: 1, suffix: "M", label: "Monthly readers", note: "Across web and app" },
  { value: 33, label: "Models road-tested", note: "On Indian roads, by our own team" },
  { value: 48000, suffix: "+", label: "Owner reviews moderated", note: "Every one read by a person" },
  { value: 0, prefix: "₹", label: "Paid for a verdict", note: "Ever. By anyone." },
];

export const aboutValues: { title: string; body: string }[] = [
  {
    title: "Clarity over noise",
    body: "Indian car buying is complicated by variants, offers and on-road maths. We make the trade-offs plain, so the decision is yours and not the salesperson's.",
  },
  {
    title: "Tested where you drive",
    body: "Every verdict is earned on Indian roads — monsoon ghats, crawling metros, empty expressways — never on a launch-event loop alone.",
  },
  {
    title: "Respect for the reader",
    body: "No dark patterns, no forced sign-ups, no recycled press releases. If a page cannot help you choose better, it does not belong on March Gear.",
  },
  {
    title: "Craft in every detail",
    body: "From photography to price tables, we hold ourselves to the standards of the best print magazines — and then make it fast on a phone.",
  },
];

export const editorialPrinciples: { title: string; body: string }[] = [
  {
    title: "Scores cannot be bought",
    body: "Advertisers and manufacturers have no say over our ratings, rankings or copy. Commercial and editorial teams report to different leaders.",
  },
  {
    title: "We pay our own way where it matters",
    body: "Long-term test cars are loaned under written terms that give the manufacturer no editorial rights. We disclose every loan at the foot of the review.",
  },
  {
    title: "Owner voices are moderated, not edited",
    body: "We remove abuse and personal data. We never soften criticism, and we never delete a negative review because a brand asked us to.",
  },
  {
    title: "Corrections are public",
    body: "When we get something wrong we fix it, date the correction and explain what changed — at the top of the story, not buried below.",
  },
];

export const aboutTimeline: { year: string; title: string; body: string }[] = [
  { year: "2019", title: "A newsletter", body: "Started as a weekly email for friends who kept asking which car to buy." },
  { year: "2021", title: "The road-test team", body: "Four full-time testers and a scoring method designed for Indian conditions." },
  { year: "2023", title: "Owners join in", body: "Verified owner reviews launch, with every submission read by a moderator." },
  { year: "2026", title: "One platform", body: "New, used and electric — research, compare and connect with dealers in one place." },
];

export interface Office {
  city: string;
  label: string;
  address: string[];
  phone: string;
  email: string;
  hours: string;
  hq?: boolean;
}

export const offices: Office[] = [
  {
    city: "Visakhapatnam",
    label: "Head office",
    address: ["Visakhapatnam", "Andhra Pradesh, India"],
    phone: "+91 91283 33777",
    email: "hello@marchgear.in",
    hours: "9:00 AM – 9:00 PM",
    hq: true,
  },
];

export const supportHours: { day: string; hours: string }[] = [{ day: "Phone & email", hours: "9:00 AM – 9:00 PM" }];

export const supportChannels = {
  email: "support@marchgear.in",
  phone: "+91 91283 33777",
  press: "press@marchgear.in",
};

export const contactTopics = [
  { value: "buying", label: "Help choosing a car" },
  { value: "listing", label: "Used-car listing or sale" },
  { value: "dealer", label: "Dealer partnership" },
  { value: "editorial", label: "Editorial feedback or correction" },
  { value: "press", label: "Press & media" },
  { value: "other", label: "Something else" },
];

export const contactFaqs: { id: string; q: string; a: string }[] = [
  {
    id: "response",
    q: "How quickly will I hear back?",
    a: "We reply to every message within one working day. Corrections to published stories are reviewed by an editor the same day.",
  },
  {
    id: "prices",
    q: "Are the prices on March Gear quotes?",
    a: "No. Prices are indicative ex-showroom and on-road estimates for demonstration. Your dealer will confirm the final price, offers and taxes for your city.",
  },
  {
    id: "dealer",
    q: "Can March Gear book a test drive for me?",
    a: "Yes — use “Book a test drive” on any car page and a partner dealer near you will call to confirm a slot. There is no charge for the service.",
  },
  {
    id: "review",
    q: "How do I report an owner review?",
    a: "Write to us with the review’s car and title. Our moderators check every report against the community guidelines within 48 hours.",
  },
  {
    id: "press",
    q: "I’m a carmaker or PR agency — who should I contact?",
    a: "Choose “Press & media” in the form. Please note that loans and launch invitations never influence our scores or rankings.",
  },
];
