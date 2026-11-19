/** Editorial content for /sell-car. Figures are illustrative demo data. */

export const SELL_STATS = [
  { value: 48000, suffix: "+", label: "Cars bought since 2019" },
  { value: 24, suffix: " hrs", label: "From inspection to payment" },
  { value: 4.8, decimals: 1, suffix: " / 5", label: "Average seller rating" },
  { value: 140, suffix: "+", label: "Inspection hubs across India" },
] as const;

export const SELL_STEPS = [
  {
    title: "Get an instant price",
    body: "Tell us about your car in under a minute and see an indicative price range based on live market data.",
    meta: "60 seconds",
  },
  {
    title: "Free doorstep inspection",
    body: "A certified engineer runs a 200-point inspection at your home or office, at a time that suits you.",
    meta: "45 minutes",
  },
  {
    title: "Final offer & paperwork",
    body: "Receive a firm offer on the spot. Accept, and we prepare the RC transfer, NOC and loan closure for you.",
    meta: "Same visit",
  },
  {
    title: "Payment & pick-up",
    body: "The full amount reaches your bank account before the car leaves your driveway. No deductions later.",
    meta: "Within 24 hours",
  },
] as const;

export const SELL_BENEFITS = [
  {
    key: "price",
    title: "Market-led pricing",
    body: "Offers are benchmarked against thousands of recent transactions in your city, not a fixed table.",
  },
  {
    key: "inspection",
    title: "Free 200-point inspection",
    body: "Engine, gearbox, body, electricals and documents, checked by an engineer and shared with you.",
  },
  {
    key: "payment",
    title: "Payment before pick-up",
    body: "Instant bank transfer on handover. We also settle any outstanding loan directly with your lender.",
  },
  {
    key: "paperwork",
    title: "Paperwork, handled",
    body: "RC transfer, Form 29/30, NOC and insurance transfer are filed by us, with proof shared on completion.",
  },
  {
    key: "privacy",
    title: "No calls from strangers",
    body: "Your number stays with us. No listings, no haggling with buyers, no test drives with people you don't know.",
  },
  {
    key: "flexible",
    title: "Change your mind freely",
    body: "There is no obligation at any stage. Decline the offer and the inspection is still free.",
  },
] as const;

export const SELL_TESTIMONIALS = [
  {
    quote: "The final offer was within ₹15,000 of the online estimate, and the money was in my account before the tow truck arrived.",
    name: "Meenakshi Raman",
    city: "Chennai",
    car: "2019 Honda City ZX CVT",
    soldFor: 865000,
  },
  {
    quote: "They closed my car loan with the bank directly. I didn't visit a single office or chase a single signature.",
    name: "Gurpreet Singh",
    city: "Chandigarh",
    car: "2020 Hyundai Creta SX",
    soldFor: 1120000,
  },
  {
    quote: "I had three buyers on a classifieds site haggling for weeks. March Gear inspected and paid on the same Saturday.",
    name: "Ankit Agarwal",
    city: "Pune",
    car: "2018 Maruti Swift VXi",
    soldFor: 445000,
  },
  {
    quote: "The engineer walked me through every item on the report. Even where the car lost points, I understood why.",
    name: "Shreya Banerjee",
    city: "Kolkata",
    car: "2021 Tata Nexon XZ+",
    soldFor: 790000,
  },
] as const;

export const SELL_FAQS = [
  {
    id: "documents",
    q: "What documents do I need to sell my car?",
    a: "The original RC, a valid insurance policy, your PAN card, an address proof and, if the car was financed, the loan account details. Our team will tell you if anything else is needed for your state.",
  },
  {
    id: "price",
    q: "How accurate is the instant price?",
    a: "The instant price is an indicative range based on the model, age, kilometres and city. The final offer depends on the physical inspection, and in most cases lands within the range shown.",
  },
  {
    id: "loan",
    q: "Can I sell a car that still has an outstanding loan?",
    a: "Yes. We pay the outstanding amount directly to your lender, obtain the NOC, and transfer the balance to you.",
  },
  {
    id: "payment",
    q: "When and how do I get paid?",
    a: "Payment is made by instant bank transfer once you accept the offer and hand over the car and documents, typically within 24 hours of inspection.",
  },
  {
    id: "rc",
    q: "Who handles the RC transfer?",
    a: "We do. You'll receive a copy of the filed transfer forms immediately and confirmation once the RTO updates the record.",
  },
  {
    id: "obligation",
    q: "Am I obliged to sell after the inspection?",
    a: "Not at all. The inspection is free and there is no obligation to accept the offer.",
  },
] as const;
