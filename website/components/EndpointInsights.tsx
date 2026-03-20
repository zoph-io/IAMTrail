"use client";

import { useState } from "react";
import { TrendingUp, MapPin, Server, Milestone } from "lucide-react";

interface MonthlyActivity {
  month: string;
  count: number;
}

interface RankedItem {
  name: string;
  count: number;
}

interface NewRegionEvent {
  region: string;
  partition: string;
  detected_at: string;
  description: string;
}

interface ChangeStats {
  totalRecords: number;
  totalChangeItems: number;
  uniqueServices: number;
  uniqueRegions: number;
  changeTypeCounts: Record<string, number>;
  partitionCounts: Record<string, number>;
  monthlyActivity: MonthlyActivity[];
  topServices: RankedItem[];
  topRegions: RankedItem[];
  newRegionTimeline: NewRegionEvent[];
  trackingSince: string | null;
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const BAR_HEIGHT = 112;

function BarChart({
  data,
  maxBars,
}: {
  data: { label: string; value: number }[];
  maxBars?: number;
}) {
  const sliced = maxBars ? data.slice(-maxBars) : data;
  const max = Math.max(...sliced.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-[3px]" style={{ height: BAR_HEIGHT }}>
      {sliced.map((d) => {
        const h = Math.max((d.value / max) * BAR_HEIGHT, 2);
        return (
          <div
            key={d.label}
            className="flex-1 min-w-0 group relative self-end"
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap">
                {d.label}: {d.value}
              </div>
            </div>
            <div
              className="w-full rounded-t bg-red-500/70 dark:bg-red-400/60 hover:bg-red-500 dark:hover:bg-red-400 transition-colors"
              style={{ height: h }}
            />
          </div>
        );
      })}
    </div>
  );
}

function HorizontalBar({
  items,
  maxItems,
  colorClass,
}: {
  items: RankedItem[];
  maxItems?: number;
  colorClass?: string;
}) {
  const sliced = maxItems ? items.slice(0, maxItems) : items;
  const max = Math.max(...sliced.map((d) => d.count), 1);
  const color = colorClass || "bg-red-500/60 dark:bg-red-400/40";

  return (
    <div className="space-y-1.5">
      {sliced.map((item) => {
        const pct = (item.count / max) * 100;
        return (
          <div key={item.name} className="flex items-center gap-2">
            <code className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 w-36 truncate text-right flex-shrink-0">
              {item.name}
            </code>
            <div className="flex-1 h-4 bg-zinc-100 dark:bg-zinc-800 rounded-sm overflow-hidden">
              <div
                className={`h-full rounded-sm ${color} transition-all`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-500 w-8 text-right flex-shrink-0">
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type Tab = "activity" | "regions" | "services" | "timeline";

export default function EndpointInsights({ stats }: { stats: ChangeStats }) {
  const [activeTab, setActiveTab] = useState<Tab>("activity");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "activity", label: "Activity", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "regions", label: "Top Regions", icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: "services", label: "Top Services", icon: <Server className="w-3.5 h-3.5" /> },
    { id: "timeline", label: "New Regions", icon: <Milestone className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "text-red-600 dark:text-red-400 border-b-2 border-red-500 dark:border-red-400 -mb-px"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === "activity" && (
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Monthly detections since{" "}
                {stats.trackingSince
                  ? formatDate(stats.trackingSince)
                  : "tracking started"}
              </p>
              <p className="text-xs font-mono text-zinc-400">
                {stats.monthlyActivity.length} months
              </p>
            </div>
            <BarChart
              data={stats.monthlyActivity.map((m) => ({
                label: formatMonth(m.month),
                value: m.count,
              }))}
            />
            <div className="flex justify-between mt-2">
              <span className="text-[10px] font-mono text-zinc-400">
                {stats.monthlyActivity.length > 0
                  ? formatMonth(stats.monthlyActivity[0].month)
                  : ""}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {stats.monthlyActivity.length > 0
                  ? formatMonth(
                      stats.monthlyActivity[stats.monthlyActivity.length - 1]
                        .month
                    )
                  : ""}
              </span>
            </div>
          </div>
        )}

        {activeTab === "regions" && (
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Regions receiving the most service expansions
            </p>
            <HorizontalBar
              items={stats.topRegions}
              maxItems={15}
              colorClass="bg-emerald-500/60 dark:bg-emerald-400/40"
            />
          </div>
        )}

        {activeTab === "services" && (
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Services expanding to the most new regions
            </p>
            <HorizontalBar
              items={stats.topServices}
              maxItems={15}
              colorClass="bg-indigo-500/60 dark:bg-indigo-400/40"
            />
          </div>
        )}

        {activeTab === "timeline" && (
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              New AWS regions detected in botocore
            </p>
            {stats.newRegionTimeline.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6 font-mono">
                No new regions detected in tracked history
              </p>
            ) : (
              <div className="relative pl-5 space-y-4">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-emerald-200 dark:bg-emerald-800" />
                {stats.newRegionTimeline
                  .slice()
                  .reverse()
                  .map((event, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-5 top-1 w-3 h-3 rounded-full bg-emerald-500 dark:bg-emerald-400 border-2 border-white dark:border-zinc-900" />
                      <div className="flex items-baseline gap-2">
                        <code className="text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {event.region}
                        </code>
                        <span className="text-xs text-zinc-400 font-mono">
                          {event.partition}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {formatDate(event.detected_at)}
                        {event.description &&
                          event.description !== event.region &&
                          ` - ${event.description}`}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
