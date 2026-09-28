import { LEVEL_META, type RiskLevel } from "@/lib/risk";

export default function RiskBadge({
  level,
  className = "",
}: {
  level: RiskLevel;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-mono font-semibold uppercase tracking-wider ${LEVEL_META[level].badge} ${className}`}
    >
      {LEVEL_META[level].label}
    </span>
  );
}
