import { getCatalog } from "@/server/catalog";
import { JsonLd } from "./json-ld";
import { SITE_NAME, SITE_URL, absoluteUrl } from "./site";

const filled = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** A real profile URL — not a bare network homepage like the "https://instagram.com" placeholders. */
function isProfileUrl(href: unknown): href is string {
  if (!filled(href)) return false;
  try {
    return new URL(href).pathname.replace(/\/+$/, "").length > 0;
  } catch {
    return false;
  }
}

/**
 * Organization + WebSite structured data for every public page. Contact details come from the `site`
 * content block. The WebSite SearchAction targets the new-car search (/new-cars?q=…), which filters the
 * catalogue by the query. No ratings or reviews: the site's reviews are sample content.
 */
export async function SiteSchema() {
  const { site } = (await getCatalog()).content;
  const orgId = `${SITE_URL}/#organization`;
  const sameAs = Object.values(site.socials ?? {}).filter(isProfileUrl);

  const organization = {
    "@type": "Organization",
    "@id": orgId,
    name: SITE_NAME,
    alternateName: "March Gear",
    ...(filled(site.legalName) ? { legalName: site.legalName.trim() } : {}),
    url: SITE_URL,
    logo: absoluteUrl("/icon.svg"),
    ...(filled(site.email) ? { email: site.email } : {}),
    ...(filled(site.phone) ? { telephone: site.phone } : {}),
    // The registered office when it's filled in; otherwise the public address line (a city, so plain text).
    ...(filled(site.registeredAddress)
      ? { address: { "@type": "PostalAddress", streetAddress: site.registeredAddress.trim(), addressCountry: "IN" } }
      : filled(site.address)
        ? { address: site.address.trim() }
        : {}),
    ...(filled(site.gstin) ? { taxID: site.gstin.trim() } : {}),
    ...(filled(site.cin) ? { identifier: { "@type": "PropertyValue", propertyID: "CIN", value: site.cin.trim() } } : {}),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        ...(filled(site.phone) ? { telephone: site.phone } : {}),
        ...(filled(site.supportEmail) ? { email: site.supportEmail } : {}),
        areaServed: "IN",
        availableLanguage: ["English"],
      },
      ...(filled(site.pressEmail) ? [{ "@type": "ContactPoint", contactType: "press", email: site.pressEmail, areaServed: "IN" }] : []),
    ],
    ...(sameAs.length ? { sameAs } : {}),
  };

  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "en-IN",
    publisher: { "@id": orgId },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/new-cars")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return <JsonLd data={{ "@context": "https://schema.org", "@graph": [organization, website] }} />;
}
