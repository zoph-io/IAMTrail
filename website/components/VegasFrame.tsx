const BULBS = [
  "bg-amber-300 shadow-[0_0_8px_#fcd34d]",
  "bg-fuchsia-400 shadow-[0_0_8px_#e879f9]",
  "bg-cyan-300 shadow-[0_0_8px_#67e8f9]",
  "bg-rose-400 shadow-[0_0_8px_#fb7185]",
];

export function BulbRow({ count = 22 }: { count?: number }) {
  return (
    <div className="flex justify-between gap-1.5 px-3 py-2.5 bg-black" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`vegas-bulb h-1.5 w-1.5 shrink-0 rounded-full ${BULBS[index % BULBS.length]}`}
          style={{ animationDelay: `${(index % 4) * 0.28}s` }}
        />
      ))}
    </div>
  );
}

export default function VegasFrame({
  children,
  bulbs = 22,
}: {
  children: React.ReactNode;
  bulbs?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-amber-400/40 bg-zinc-950 text-zinc-100 shadow-[0_0_48px_-18px_rgba(232,121,249,0.45)]">
      <BulbRow count={bulbs} />
      {children}
    </div>
  );
}
