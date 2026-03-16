import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse All AWS Managed IAM Policies",
  description:
    "Search, filter, and explore all AWS Managed IAM Policies. View version history, creation dates, and modification counts.",
  alternates: {
    canonical: "https://iamtrail.com/policies",
  },
  openGraph: {
    title: "Browse All AWS Managed IAM Policies | IAMTrail",
    description:
      "Search, filter, and explore all AWS Managed IAM Policies with full version history.",
    url: "https://iamtrail.com/policies",
  },
};

export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
