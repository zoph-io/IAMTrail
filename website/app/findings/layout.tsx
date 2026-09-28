import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Risky AWS Managed IAM Policies: Privilege Escalation and Broad Access",
  description:
    "Which AWS managed IAM policies grant admin, privilege escalation paths, secret reads or the power to disable monitoring, ranked by risk, with what changed recently.",
  path: "/findings",
});

export default function FindingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
