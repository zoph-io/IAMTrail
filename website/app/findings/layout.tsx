import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Findings - Access Analyzer & pathfinding.cloud",
  description:
    "AWS IAM Access Analyzer validation plus action-level overlap with documented privilege escalation paths from pathfinding.cloud on AWS managed policies in IAMTrail.",
  alternates: {
    canonical: "https://iamtrail.com/findings",
  },
  openGraph: {
    title: "Security Findings | IAMTrail",
    description:
      "Access Analyzer results and pathfinding.cloud path overlaps on archived AWS managed IAM policies.",
    url: "https://iamtrail.com/findings",
  },
};

export default function FindingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
