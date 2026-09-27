import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Known AWS Account Lookup",
  description:
    "Look up one or many AWS account IDs at once to identify their owners. Powered by the fwdcloudsec community database of known AWS vendor accounts.",
  path: "/accounts",
});

export default function AccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
