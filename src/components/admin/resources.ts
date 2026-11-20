import { toOptions, type Section } from "./fields";

/* Edit-form layouts for each catalogue resource. Options marked "from DB"
   are filled in by the page with withOptions(). */

const FUELS = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"] as const;
const TRANSMISSIONS = ["Manual", "Automatic", "AMT", "DCT", "CVT"] as const;
const BODY_TYPES = ["SUV", "Sedan", "Hatchback", "MUV", "Coupe"] as const;
const PUBLISH = [
  { value: "published", label: "Published — visible on the site" },
  { value: "draft", label: "Draft — hidden" },
];

export const brandSections: Section[] = [
  {
    title: "Brand",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "URL slug", type: "text", required: true, slugFrom: "name", hint: "Used in /brands/<slug>. Changing it updates every car of this brand." },
      { name: "country", label: "Country", type: "text", required: true },
      { name: "founded", label: "Founded (year)", type: "number", required: true, min: 1800, max: 2100 },
      { name: "tagline", label: "Tagline", type: "text", required: true, wide: true },
      { name: "description", label: "Description", type: "textarea", required: true },
      { name: "heroImage", label: "Hero image URL", type: "image", required: true, wide: true },
    ],
  },
  {
    title: "Visibility",
    fields: [
      { name: "isLuxury", label: "Luxury brand", type: "checkbox", hint: "Groups it under Luxury on /brands." },
      { name: "isActive", label: "Show on the website", type: "checkbox", hint: "Hiding a brand also hides its cars." },
      { name: "sortOrder", label: "Sort order", type: "number", required: true, hint: "Lower numbers appear first." },
    ],
  },
];

export const carSections: Section[] = [
  {
    title: "Basics",
    fields: [
      { name: "name", label: "Model name", type: "text", required: true, placeholder: "Creta" },
      { name: "slug", label: "URL slug", type: "text", required: true, slugFrom: "name", hint: "Used in /cars/<slug>, e.g. hyundai-creta." },
      { name: "brand", label: "Brand", type: "select", required: true, options: [] /* from DB */ },
      { name: "bodyType", label: "Body type", type: "select", required: true, options: toOptions(BODY_TYPES) },
      { name: "status", label: "Status", type: "select", required: true, options: PUBLISH },
      { name: "launchedOn", label: "Launched on", type: "date", hint: "Recent dates appear under Latest launches." },
      { name: "tagline", label: "Tagline", type: "text", required: true, wide: true },
      { name: "overview", label: "Overview", type: "textarea", required: true, rows: 5 },
      { name: "isLuxury", label: "Luxury model", type: "checkbox" },
      { name: "trending", label: "Trending", type: "checkbox", hint: "Featured in Trending on the home page." },
      { name: "sortOrder", label: "Sort order", type: "number", required: true },
    ],
  },
  {
    title: "Price & running costs",
    fields: [
      { name: "priceMin", label: "Starting price (ex-showroom)", type: "number", required: true, prefix: "₹", min: 0 },
      { name: "priceMax", label: "Top price (ex-showroom)", type: "number", required: true, prefix: "₹", min: 0 },
      { name: "fuelTypes", label: "Fuel types", type: "multi", required: true, options: toOptions(FUELS) },
      { name: "transmissions", label: "Transmissions", type: "multi", required: true, options: toOptions(TRANSMISSIONS) },
      { name: "efficiency", label: "Efficiency (as shown)", type: "text", required: true, placeholder: "17.4 – 21.8 kmpl or Up to 473 km" },
      { name: "efficiencyValue", label: "Best efficiency figure", type: "number", required: true, step: 0.1, hint: "kmpl, or km of range for EVs — used for sorting." },
    ],
  },
  {
    title: "Specifications",
    fields: [
      { name: "engine", label: "Engine / motor", type: "text", required: true },
      { name: "power", label: "Power", type: "text", required: true, placeholder: "158 bhp" },
      { name: "torque", label: "Torque", type: "text", required: true, placeholder: "253 Nm" },
      { name: "seats", label: "Seating", type: "multi", required: true, options: toOptions(["2", "4", "5", "6", "7", "8", "9"]) },
      { name: "safetyRating", label: "Crash-test stars", type: "number", required: true, min: 0, max: 5 },
      { name: "safetyAgency", label: "Crash-test agency", type: "select", required: true, options: toOptions(["Bharat NCAP", "Global NCAP", "Euro NCAP", "ASEAN NCAP", "Not tested"]) },
      { name: "airbags", label: "Airbags", type: "number", required: true, min: 0, max: 12 },
      { name: "bootSpace", label: "Boot space", type: "number", required: true, suffix: "litres", min: 0 },
      { name: "groundClearance", label: "Ground clearance", type: "number", required: true, suffix: "mm", min: 0 },
      { name: "fuelTank", label: "Fuel tank", type: "number", suffix: "litres", min: 0 },
      { name: "topSpeed", label: "Top speed", type: "number", required: true, suffix: "km/h", min: 0 },
      { name: "acceleration", label: "0–100 km/h", type: "text", required: true, placeholder: "9.8 s" },
      {
        name: "dimensions",
        label: "Dimensions (mm)",
        type: "group",
        fields: [
          { name: "length", label: "Length", type: "number", required: true, suffix: "mm" },
          { name: "width", label: "Width", type: "number", required: true, suffix: "mm" },
          { name: "height", label: "Height", type: "number", required: true, suffix: "mm" },
          { name: "wheelbase", label: "Wheelbase", type: "number", required: true, suffix: "mm" },
        ],
      },
      {
        name: "ev",
        label: "Electric specs",
        type: "group",
        optionalLabel: "This model has an electric version",
        fields: [
          { name: "rangeKm", label: "Claimed range", type: "number", required: true, suffix: "km" },
          { name: "batteryKwh", label: "Battery", type: "number", required: true, step: 0.1, suffix: "kWh" },
          { name: "motorKw", label: "Motor output", type: "number", required: true, suffix: "kW" },
          { name: "dcCharge", label: "DC fast charge", type: "text", required: true, placeholder: "58 min (10–80%)" },
          { name: "acCharge", label: "AC charge", type: "text", required: true, placeholder: "6 h (11 kW)" },
        ],
      },
    ],
  },
  {
    title: "Photos & colours",
    fields: [
      { name: "images", label: "Photos", type: "images", required: true },
      { name: "focus", label: "Cover crop focus", type: "text", placeholder: "50% 60%", hint: "CSS object-position for tight crops." },
      {
        name: "colors",
        label: "Colours",
        type: "rows",
        addLabel: "Add colour",
        fields: [
          { name: "name", label: "Name", type: "text", required: true },
          { name: "hex", label: "Colour", type: "color", required: true },
        ],
      },
    ],
  },
  {
    title: "Variants",
    description: "Each trim on sale, with its own price and features.",
    fields: [
      {
        name: "variants",
        label: "Variants",
        type: "rows",
        addLabel: "Add variant",
        fields: [
          { name: "name", label: "Name", type: "text", required: true, placeholder: "SX(O) Turbo DCT" },
          { name: "slug", label: "URL slug", type: "text", required: true, placeholder: "sx-o-turbo-dct" },
          { name: "fuel", label: "Fuel", type: "select", required: true, options: toOptions(FUELS) },
          { name: "transmission", label: "Transmission", type: "select", required: true, options: toOptions(TRANSMISSIONS) },
          { name: "price", label: "Ex-showroom price", type: "number", required: true, prefix: "₹" },
          { name: "efficiency", label: "Efficiency", type: "text", required: true, placeholder: "18.4 kmpl" },
          { name: "features", label: "Key features", type: "lines", rows: 3 },
        ],
      },
    ],
  },
  {
    title: "Features",
    fields: [
      {
        name: "features",
        label: "Feature groups",
        type: "rows",
        addLabel: "Add feature group",
        itemTitle: "group",
        fields: [
          { name: "group", label: "Group", type: "select", required: true, options: toOptions(["Comfort", "Infotainment", "Safety", "Exterior", "Interior", "Performance"]) },
          { name: "items", label: "Features", type: "lines", rows: 4 },
        ],
      },
    ],
  },
  {
    title: "Review & verdict",
    fields: [
      { name: "highlights", label: "Highlights", type: "lines" },
      { name: "pros", label: "Pros", type: "lines" },
      { name: "cons", label: "Cons", type: "lines" },
      { name: "expertScore", label: "Expert score", type: "number", required: true, step: 0.1, min: 0, max: 10, suffix: "/ 10" },
      { name: "expertVerdict", label: "Expert verdict", type: "textarea", required: true },
      { name: "rating", label: "Owner rating", type: "number", required: true, step: 0.1, min: 0, max: 5, suffix: "/ 5" },
      { name: "reviewCount", label: "Owner review count", type: "number", required: true, min: 0 },
      { name: "competitors", label: "Competitors", type: "multi", options: [] /* from DB */, hint: "Shown as rivals on the model page." },
    ],
  },
];

export const upcomingSections: Section[] = [
  {
    title: "Upcoming launch",
    fields: [
      { name: "name", label: "Model name", type: "text", required: true },
      { name: "slug", label: "URL slug", type: "text", required: true, slugFrom: "name" },
      { name: "brand", label: "Brand", type: "select", required: true, options: [] /* from DB */ },
      { name: "status", label: "Status", type: "select", required: true, options: PUBLISH },
      { name: "bodyType", label: "Body type", type: "select", required: true, options: toOptions(BODY_TYPES) },
      { name: "fuel", label: "Fuel", type: "select", required: true, options: toOptions(FUELS) },
      { name: "expectedLaunch", label: "Expected launch", type: "text", required: true, placeholder: "March 2027" },
      { name: "sortOrder", label: "Sort order", type: "number", required: true },
      { name: "priceMin", label: "Expected price from", type: "number", required: true, prefix: "₹" },
      { name: "priceMax", label: "Expected price to", type: "number", required: true, prefix: "₹" },
      { name: "image", label: "Image URL", type: "image", required: true, wide: true },
      { name: "teaser", label: "Teaser", type: "textarea", required: true },
      { name: "highlights", label: "Highlights", type: "lines" },
    ],
  },
];

export const usedSections: Section[] = [
  {
    title: "Listing",
    fields: [
      { name: "status", label: "Status", type: "select", required: true, options: toOptions(["active", "reserved", "sold", "draft"]).map((o) => ({ ...o, label: o.label[0].toUpperCase() + o.label.slice(1) })) },
      { name: "postedOn", label: "Posted on", type: "date", required: true },
      { name: "price", label: "Asking price", type: "number", required: true, prefix: "₹" },
      { name: "newPrice", label: "Original new price", type: "number", prefix: "₹", hint: "Shows the saving on the listing." },
      { name: "verified", label: "MarchGear verified", type: "checkbox" },
      { name: "inspectionScore", label: "Inspection score", type: "number", required: true, min: 0, max: 100, suffix: "/ 100" },
    ],
  },
  {
    title: "Car",
    fields: [
      { name: "brand", label: "Brand", type: "select", required: true, options: [] /* from DB */ },
      { name: "modelSlug", label: "Links to new-car model", type: "select", allowEmpty: true, options: [] /* from DB */, placeholder: "None" },
      { name: "name", label: "Model name", type: "text", required: true },
      { name: "variant", label: "Variant", type: "text", required: true },
      { name: "year", label: "Year", type: "number", required: true, min: 1990, max: 2100 },
      { name: "km", label: "Kilometres", type: "number", required: true, suffix: "km", min: 0 },
      { name: "fuel", label: "Fuel", type: "select", required: true, options: toOptions(FUELS) },
      { name: "transmission", label: "Transmission", type: "select", required: true, options: toOptions(TRANSMISSIONS) },
      { name: "bodyType", label: "Body type", type: "select", required: true, options: toOptions(BODY_TYPES) },
      { name: "owners", label: "Owners", type: "number", required: true, min: 1, max: 10 },
      { name: "color", label: "Colour", type: "text", required: true },
      { name: "city", label: "City", type: "select", required: true, options: [] /* from cities */ },
      { name: "registration", label: "Registration", type: "text", required: true, placeholder: "MH-02" },
      { name: "insurance", label: "Insurance", type: "text", required: true, placeholder: "Comprehensive till Aug 2027" },
      { name: "highlights", label: "Highlights", type: "lines" },
    ],
  },
  {
    title: "Photos",
    fields: [
      { name: "images", label: "Photos", type: "images", required: true },
      { name: "focus", label: "Cover crop focus", type: "text", placeholder: "50% 60%" },
    ],
  },
  {
    title: "Seller",
    fields: [
      { name: "sellerType", label: "Seller type", type: "select", required: true, options: toOptions(["Dealer", "Individual"]) },
      { name: "sellerName", label: "Seller name", type: "text", required: true },
      { name: "dealerId", label: "Dealer", type: "select", allowEmpty: true, options: [] /* from DB */, placeholder: "Not a partner dealer" },
    ],
  },
];

export const dealerSections: Section[] = [
  {
    title: "Showroom",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "id", label: "ID (URL)", type: "text", required: true, slugFrom: "name", hint: "Used in /dealers/<id>." },
      { name: "brand", label: "Brand", type: "select", required: true, options: [] /* from DB + multi-brand */ },
      { name: "city", label: "City", type: "select", required: true, options: [] /* from cities */ },
      { name: "area", label: "Area", type: "text", required: true },
      { name: "established", label: "Established (year)", type: "number", required: true, min: 1900, max: 2100 },
      { name: "address", label: "Address", type: "text", required: true, wide: true },
      { name: "phone", label: "Phone", type: "text", required: true },
      { name: "email", label: "Email", type: "text", required: true },
      { name: "hours", label: "Opening hours", type: "text", required: true, wide: true },
      { name: "image", label: "Photo URL", type: "image", required: true, wide: true },
      { name: "services", label: "Services", type: "lines" },
    ],
  },
  {
    title: "Ratings & visibility",
    fields: [
      { name: "rating", label: "Rating", type: "number", required: true, step: 0.1, min: 0, max: 5, suffix: "/ 5" },
      { name: "reviewCount", label: "Review count", type: "number", required: true, min: 0 },
      { name: "distanceKm", label: "Distance from city centre", type: "number", required: true, step: 0.1, suffix: "km" },
      { name: "sortOrder", label: "Sort order", type: "number", required: true },
      { name: "usedInventory", label: "Sells used cars", type: "checkbox" },
      { name: "isActive", label: "Show on the website", type: "checkbox" },
    ],
  },
  {
    title: "Profile page",
    fields: [
      {
        name: "profile",
        label: "Profile",
        type: "group",
        optionalLabel: "Show a full showroom profile",
        fields: [
          { name: "about", label: "About", type: "textarea", required: true, wide: true },
          { name: "showroomArea", label: "Showroom area", type: "text", required: true, placeholder: "18,500 sq ft" },
          { name: "serviceBays", label: "Service bays", type: "number", required: true, min: 0 },
          { name: "bearing", label: "Map bearing", type: "number", required: true, min: 0, max: 359, hint: "Compass direction from the city centre." },
          { name: "facilities", label: "Facilities", type: "lines" },
          { name: "languages", label: "Languages spoken", type: "lines" },
        ],
      },
    ],
  },
];

export const ARTICLE_CATEGORIES = ["News", "Expert Review", "First Drive", "Industry", "Electric", "Video", "Ownership"] as const;

export const articleSections: Section[] = [
  {
    title: "Story",
    fields: [
      { name: "title", label: "Headline", type: "text", required: true, wide: true },
      { name: "slug", label: "URL slug", type: "text", required: true, slugFrom: "title" },
      { name: "category", label: "Category", type: "select", required: true, options: toOptions(ARTICLE_CATEGORIES) },
      { name: "dek", label: "Standfirst", type: "textarea", required: true, rows: 2, hint: "The one- or two-line summary under the headline." },
      { name: "body", label: "Body", type: "lines", required: true, rows: 14, hint: "One paragraph per line." },
      { name: "pullQuote", label: "Pull quote", type: "textarea", rows: 2 },
    ],
  },
  {
    title: "Publishing",
    fields: [
      { name: "status", label: "Status", type: "select", required: true, options: PUBLISH },
      { name: "publishedOn", label: "Publish date", type: "date", required: true, hint: "Pick a future date to schedule the story — it goes live that day." },
      { name: "authorId", label: "Author", type: "select", required: true, options: [] /* from DB */ },
      { name: "readMinutes", label: "Reading time", type: "number", required: true, min: 1, max: 60, suffix: "min" },
      { name: "image", label: "Cover image URL", type: "image", required: true, wide: true },
      { name: "relatedCar", label: "Related car", type: "select", allowEmpty: true, options: [] /* from DB */, placeholder: "None" },
      { name: "videoDuration", label: "Video length", type: "text", placeholder: "8:42", hint: "Only for Video stories." },
      { name: "tags", label: "Tags", type: "lines", rows: 3 },
    ],
  },
];

export const authorSections: Section[] = [
  {
    title: "Author",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "id", label: "ID", type: "text", required: true, slugFrom: "name", hint: "Short, permanent identifier." },
      { name: "role", label: "Role", type: "text", required: true, wide: true, placeholder: "Senior Road Tester" },
    ],
  },
  {
    title: "Profile",
    description: "Shown on the author's page and under their stories.",
    fields: [
      { name: "bio", label: "Bio", type: "textarea", rows: 4 },
      { name: "beat", label: "Covers", type: "text", placeholder: "EVs, charging and technology" },
      { name: "base", label: "Based in", type: "text", placeholder: "Bengaluru" },
      { name: "joined", label: "Joined MarchGear (year)", type: "number", min: 1950, max: 2100 },
    ],
  },
];
