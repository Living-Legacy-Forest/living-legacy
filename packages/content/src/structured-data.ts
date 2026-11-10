/**
 * schema.org structured data for the website, built in one place so every page
 * describes the organisation, the site and its breadcrumbs the same way.
 *
 * The organisation and website nodes carry stable `@id`s (`<site>/#organization`,
 * `<site>/#website`) that other nodes point at, so search engines read the
 * publisher of every post as the same entity rather than a fresh copy each time.
 */
export type JsonLd = Record<string, unknown>;

const CONTEXT = 'https://schema.org';

export const organizationId = (siteUrl: string) => new URL('/#organization', siteUrl).toString();
export const websiteId = (siteUrl: string) => new URL('/#website', siteUrl).toString();

export function organizationJsonLd(org: {
  siteUrl: string;
  name: string;
  legalName?: string;
  email?: string;
  telephone?: string;
  address?: string;
  sameAs?: string[];
}): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': organizationId(org.siteUrl),
    name: org.name,
    url: new URL('/', org.siteUrl).toString(),
    ...(org.legalName ? { legalName: org.legalName } : {}),
    ...(org.email ? { email: org.email } : {}),
    ...(org.telephone ? { telephone: org.telephone } : {}),
    ...(org.address ? { address: org.address } : {}),
    ...(org.sameAs?.length ? { sameAs: org.sameAs } : {}),
  };
}

export function websiteJsonLd(site: { siteUrl: string; name: string; locale?: string }): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': websiteId(site.siteUrl),
    name: site.name,
    url: new URL('/', site.siteUrl).toString(),
    publisher: { '@id': organizationId(site.siteUrl) },
    ...(site.locale ? { inLanguage: site.locale } : {}),
  };
}

/** Crumbs in order from the home page; the last one is the page itself. */
export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

export function blogPostingJsonLd(post: {
  siteUrl: string;
  url: string;
  headline: string;
  datePublished: string;
  dateModified?: string;
  description?: string;
  image?: string;
  authorName?: string;
  section?: string;
  keywords?: string[];
}): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'BlogPosting',
    headline: post.headline,
    url: post.url,
    datePublished: post.datePublished,
    dateModified: post.dateModified ?? post.datePublished,
    mainEntityOfPage: { '@type': 'WebPage', '@id': post.url },
    isPartOf: { '@id': websiteId(post.siteUrl) },
    publisher: { '@id': organizationId(post.siteUrl) },
    ...(post.description ? { description: post.description } : {}),
    ...(post.image ? { image: [post.image] } : {}),
    ...(post.authorName ? { author: { '@type': 'Person', name: post.authorName } } : {}),
    ...(post.section ? { articleSection: post.section } : {}),
    ...(post.keywords?.length ? { keywords: post.keywords.join(', ') } : {}),
  };
}

/**
 * JSON for a `<script type="application/ld+json">` body. `<` is escaped because a
 * title containing "</script>" would otherwise end the tag early.
 */
export function serializeJsonLd(value: JsonLd | JsonLd[]): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
