import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Browse All AWS Managed IAM Policies",
  description:
    "Search every AWS Managed IAM Policy by name, or by IAM action to find each policy that grants it, including through wildcards. Full version history.",
  path: "/policies",
});

export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
