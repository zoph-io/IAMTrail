"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Region {
  code: string;
  name: string;
}

interface Service {
  id: string;
  endpointCount: number;
  regionCount: number;
  isRegionalized: boolean;
}

interface PartitionSummary {
  partition: string;
  partitionName: string;
  dnsSuffix: string;
  regionCount: number;
  serviceCount: number;
  regions: Region[];
  services: Service[];
}

export default function PartitionExplorer({
  partitions,
}: {
  partitions: PartitionSummary[];
}) {
  const [expandedPartition, setExpandedPartition] = useState<string>("aws");
  const [activeTab, setActiveTab] = useState<"regions" | "services">(
    "regions"
  );
  const [serviceSearch, setServiceSearch] = useState("");

  const activePartition = partitions.find(
    (p) => p.partition === expandedPartition
  );

  const filteredServices = useMemo(() => {
    if (!activePartition) return [];
    if (!serviceSearch) return activePartition.services;
    const term = serviceSearch.toLowerCase();
    return activePartition.services.filter((s) =>
      s.id.toLowerCase().includes(term)
    );
  }, [activePartition, serviceSearch]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
          Partition Explorer
        </h3>
      </div>

      <div className="flex flex-wrap gap-1 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        {partitions.map((p) => (
          <button
            key={p.partition}
            onClick={() => {
              setExpandedPartition(p.partition);
              setServiceSearch("");
            }}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              expandedPartition === p.partition
                ? "bg-red-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {p.partition}
            <span className="ml-1 opacity-70">
              {p.regionCount}r / {p.serviceCount}s
            </span>
          </button>
        ))}
      </div>

      {activePartition && (
        <>
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                {activePartition.partitionName}
              </span>
              <span className="ml-2 text-xs font-mono text-zinc-400 dark:text-zinc-500">
                {activePartition.dnsSuffix}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("regions")}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  activeTab === "regions"
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Regions ({activePartition.regionCount})
              </button>
              <button
                onClick={() => setActiveTab("services")}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  activeTab === "services"
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Services ({activePartition.serviceCount})
              </button>
            </div>
          </div>

          {activeTab === "regions" && (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
              {activePartition.regions.map((r) => (
                <div
                  key={r.code}
                  className="px-5 py-2.5 flex items-center justify-between"
                >
                  <code className="text-sm font-mono text-zinc-900 dark:text-white">
                    {r.code}
                  </code>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "services" && (
            <>
              <div className="px-5 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <input
                  type="text"
                  className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-xs font-mono"
                  placeholder="Search services..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                  {filteredServices.length} service
                  {filteredServices.length !== 1 ? "s" : ""}
                  {serviceSearch ? " matching" : ""}
                </p>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
                {filteredServices.map((s) => (
                  <div
                    key={s.id}
                    className="px-5 py-2.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="text-sm font-mono text-zinc-900 dark:text-white truncate">
                        {s.id}
                      </code>
                      {!s.isRegionalized && (
                        <span className="flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                          global
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 flex-shrink-0 ml-2">
                      {s.regionCount} region{s.regionCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
