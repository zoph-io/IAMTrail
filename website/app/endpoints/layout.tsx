import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AWS Endpoint Changes - Botocore Monitor",
  description:
    "Track AWS infrastructure changes from botocore endpoints.json - new regions, new services, and endpoint expansions detected automatically.",
  alternates: {
    canonical: "https://iamtrail.com/endpoints",
  },
  openGraph: {
    siteName: "IAMTrail",
    title: "AWS Endpoint Changes | IAMTrail",
    description:
      "Monitor AWS infrastructure signals - new regions, services, and endpoint changes tracked from botocore.",
    url: "https://iamtrail.com/endpoints",
    images: ["/social.png"],
  },
};

export default function EndpointsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
