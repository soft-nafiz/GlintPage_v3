import type { Metadata } from "next";

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://glintpage.com";

export const siteConfig = {
  name: "Glintpage",
  url: rawSiteUrl.replace(/\/$/, ""),
  title: "Glintpage - AI Book Reader and Translator",
  description:
    "Read PDFs, EPUBs, and public domain books in any language with an AI-powered reader built for translation, summaries, audio, and distraction-free reading.",
  image: "/mockup.png",
  keywords: [
    "AI book reader",
    "AI book translator",
    "EPUB translator",
    "PDF translator",
    "translate books online",
    "AI reading app",
    "multilingual reading",
    "book summary AI",
    "audiobook AI",
    "Glintpage",
  ],
};

export function absoluteUrl(path = "/") {
  if (path.startsWith("http")) return path;
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

type SeoOptions = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
  type?: "website" | "article";
};

export function createMetadata({
  title,
  description,
  path = "/",
  keywords = [],
  image = siteConfig.image,
  noIndex = false,
  type = "website",
}: SeoOptions): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  return {
    title,
    description,
    keywords: [...siteConfig.keywords, ...keywords],
    alternates: {
      canonical: url,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      type,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} AI reading interface`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function jsonLd(data: Record<string, unknown>) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}
