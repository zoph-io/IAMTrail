"use client";

import { useEffect, useState } from "react";
import { relativeDay } from "@/lib/changes";

/**
 * "3 days ago" against the visitor's clock. The static build cannot know it, so
 * the HTML carries the date itself, which crawlers can read and which never goes
 * stale, and the relative form replaces it once mounted.
 */
export default function RelativeDay({
  date,
  className,
}: {
  date: string;
  className?: string;
}) {
  const [label, setLabel] = useState(() =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
  );
  useEffect(() => setLabel(relativeDay(date)), [date]);
  return (
    <time dateTime={date} className={className}>
      {label}
    </time>
  );
}
