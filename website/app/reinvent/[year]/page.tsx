import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReinventEditionView from "@/components/ReinventEditionView";
import RelatedPages from "@/components/RelatedPages";
import { plural } from "@/lib/changes";
import { loadReinvent } from "@/lib/reinvent";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  try {
    return loadReinvent().editions.map((edition) => ({ year: edition.year }));
  } catch (error) {
    console.error("Error loading re:Invent seasons:", error);
    return [];
  }
}

export async function generateMetadata(props: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await props.params;
  const edition = loadReinvent().editions.find((item) => item.year === year);
  const pre = edition
    ? edition.whatsNewPosts.available
      ? edition.whatsNewPosts.items.filter((post) => post.timing === "before").length
      : null
    : null;
  const description = !edition
    ? `re:Invent ${year} in the IAMTrail archive of AWS managed IAM policy changes.`
    : pre === null
      ? `re:Invent ${year}: ${plural(edition.services.length, "new AWS service")} in managed IAM policies. What's New data unavailable.`
      : `re:Invent ${year}: ${plural(pre, "pre-re:Invent announcement")} and ${plural(edition.services.length, "new AWS service")} in managed IAM policies.`;
  return pageMetadata({
    title: `re:Invent ${year}`,
    description,
    path: `/reinvent/${year}`,
  });
}

export default async function ReinventYearPage(props: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await props.params;
  const archive = loadReinvent();
  const edition = archive.editions.find((item) => item.year === year);
  if (!edition) notFound();

  return (
    <div className="space-y-10">
      <ReinventEditionView edition={edition} archive={archive} />
      <RelatedPages current="/reinvent" />
    </div>
  );
}
