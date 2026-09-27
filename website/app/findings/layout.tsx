import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Security Findings: Access Analyzer and Escalation Paths",
  description:
    "IAM Access Analyzer validation findings and overlaps with documented privilege escalation paths from pathfinding.cloud, for every AWS managed IAM policy.",
  path: "/findings",
});

export default function FindingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
