import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { policyOgSize } from "@/lib/policyOgSize";

const ogPng = "https://iamtrail.com/endpoints/opengraph.png";

export const metadata: Metadata = pageMetadata({
  title: "AWS Endpoint Changes: New Regions and Services",
  description:
    "New AWS regions, services and endpoint expansions, detected automatically from the botocore endpoints.json that every AWS SDK ships with.",
  path: "/endpoints",
  image: {
    url: ogPng,
    width: policyOgSize.width,
    height: policyOgSize.height,
    alt: "IAMTrail - AWS Endpoint Changes preview",
  },
});

export default function EndpointsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
