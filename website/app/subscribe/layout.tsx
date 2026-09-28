import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Get Alerts When AWS Managed IAM Policies Change",
  description:
    "Free email or Slack alerts when the AWS managed IAM policies you use change. Paste the policies attached in your account, then pick instant, daily or weekly.",
  path: "/subscribe",
});

export default function SubscribeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
