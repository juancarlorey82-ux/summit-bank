import { cn } from "@/lib/utils";

export function BankLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 40 40"
        className="h-9 w-9 shrink-0"
        aria-hidden="true"
        shapeRendering="geometricPrecision"
      >
        <rect
          x="1"
          y="1"
          width="38"
          height="38"
          fill="none"
          stroke="#af915f"
          strokeWidth="1.5"
        />
        <path
          d="M8 30 L20 10 L32 30"
          fill="none"
          stroke="#af915f"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M14 30 L20 20.5 L26 30"
          fill="none"
          stroke="#fce1b6"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <line x1="8" y1="33" x2="32" y2="33" stroke="#af915f" strokeWidth="1.5" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-lg tracking-[0.28em] text-foreground">
            SUMMIT
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.42em] text-gold">
            Private Bank
          </div>
        </div>
      )}
    </div>
  );
}
