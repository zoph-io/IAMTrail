import type { Metadata } from "next";
import { SITE_URL } from "@/lib/galaxy";

export const SITE_NAME = "IAMTrail";
export const DEFAULT_OG_IMAGE = {
  url: "/social.png",
  width: 1200,
  height: 630,
  alt: "IAMTrail - AWS Managed Policy Changes Archive by zoph.io",
};

/**
 * The absolute URL of a route as it is served. trailingSlash is on, and a route
 * ending in something file-like (a policy named "X.json") is not normalised by
 * Next, so the slash is added here rather than left to the framework.
 */
export function absoluteUrl(path: string): string {
  if (path === "" || path === "/") return `${SITE_URL}/`;
  const withLead = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${withLead.endsWith("/") ? withLead : `${withLead}/`}`;
}

/** Cut at a word boundary, since search results truncate near 160 characters. */
export function clampDescription(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

type PageMetadataInput = {
  /** Without the brand, which is appended as " | IAMTrail". */
  title?: string;
  description: string;
  path: string;
  /** A per-page preview image, such as a policy's generated card. */
  image?: { url: string; width: number; height: number; alt: string };
  /** For pages nobody should land on from search, like a token-gated one. */
  noindex?: boolean;
  /** Used as is instead of title, when the brand already leads it. */
  absoluteTitle?: string;
  /** Feeds advertised by this page, the all-changes feed when omitted. */
  feeds?: { url: string; title: string }[];
};

const ALL_FEED = { url: "/feeds/all.xml", title: "IAMTrail - All Changes" };

/**
 * Title, description, canonical, Open Graph and Twitter for one route.
 *
 * Next replaces a parent's openGraph and twitter objects wholesale rather than
 * merging them, so a page that set only a canonical used to inherit the
 * homepage's og:url and og:title, and every share previewed as the homepage.
 * Building all of them together keeps them in step.
 */
export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  noindex = false,
  absoluteTitle,
  feeds = [ALL_FEED],
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = absoluteTitle ?? `${title} | ${SITE_NAME}`;
  const desc = clampDescription(description);
  return {
    // Absolute, because a layout that sets its own title string stops the root
    // template from reaching its children: every policy page lost "| IAMTrail".
    title: { absolute: fullTitle },
    description: desc,
    alternates: { canonical: url, types: { "application/rss+xml": feeds } },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
      url,
      title: fullTitle,
      description: desc,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: desc,
      images: [image.url],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** schema.org BreadcrumbList for a page reached through the given trail. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}
