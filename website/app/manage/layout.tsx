import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Manage Your Subscription",
  description:
    "Change the policies, topics, frequency and Slack channel of your IAMTrail subscription, or unsubscribe.",
  path: "/manage",
  noindex: true,
});

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
