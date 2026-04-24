import type { Metadata } from "next";
import { policyOgSize } from "@/lib/policyOgSize";
import PolicyDetailClient from "./PolicyDetailClient";

export async function generateStaticParams() {
  const fs = require("fs");
  const path = require("path");
  const dataPath = path.join(process.cwd(), "public/data/summary.json");

  try {
    const data = fs.readFileSync(dataPath, "utf8");
    const summary = JSON.parse(data);
    return summary.policies.map((policy: any) => ({
      name: policy.name,
    }));
  } catch (error) {
    console.error("Error loading policies for static params:", error);
    return [];
  }
}

export async function generateMetadata(props: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const policyName = decodeURIComponent(params.name);
  const policyPath = encodeURIComponent(policyName);
  const ogPng = `https://iamtrail.com/policies/${policyPath}/opengraph.png`;
  return {
    title: `${policyName} - AWS Managed IAM Policy`,
    description: `View the full version history, JSON document, and change log for the ${policyName} AWS Managed IAM Policy.`,
    alternates: {
      canonical: `https://iamtrail.com/policies/${encodeURIComponent(policyName)}`,
    },
    openGraph: {
      siteName: "IAMTrail",
      title: `${policyName} | IAMTrail`,
      description: `Version history and details for the ${policyName} AWS Managed IAM Policy.`,
      url: `https://iamtrail.com/policies/${encodeURIComponent(policyName)}`,
      images: [
        {
          url: ogPng,
          width: policyOgSize.width,
          height: policyOgSize.height,
          alt: `IAMTrail - ${policyName} managed policy preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${policyName} | IAMTrail`,
      description: `Version history and details for the ${policyName} AWS Managed IAM Policy.`,
      images: [ogPng],
    },
  };
}

export default async function PolicyDetailPage(props: {
  params: Promise<{ name: string }>;
}) {
  const params = await props.params;
  return <PolicyDetailClient policyName={params.name} />;
}
