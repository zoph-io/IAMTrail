import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { policyOgSize } from "@/lib/policyOgSize";

const ogPng = "https://iamtrail.com/guardduty/opengraph.png";

export const metadata: Metadata = pageMetadata({
  title: "GuardDuty Announcements Monitor",
  description:
    "Every AWS GuardDuty SNS announcement, archived: new and updated findings, feature launches and region expansions, detected automatically.",
  path: "/guardduty",
  image: {
    url: ogPng,
    width: policyOgSize.width,
    height: policyOgSize.height,
    alt: "IAMTrail - GuardDuty Announcements preview",
  },
});

export default function GuardDutyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
