import { cn } from "@/lib/utils";

/** Rotating circular seal — gold text ring around the Summit mark. */
export function SealBadge({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-32 w-32", className)} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="animate-seal h-full w-full">
        <defs>
          <path
            id="seal-circle"
            d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0"
          />
        </defs>
        <text
          fill="#af915f"
          fontSize="10.5"
          letterSpacing="3.5"
          fontFamily="Inter, sans-serif"
        >
          <textPath href="#seal-circle">
            SUMMIT PRIVATE BANK • EST. MMXXVI •
          </textPath>
        </text>
      </svg>
      <svg
        viewBox="0 0 40 40"
        className="absolute inset-0 m-auto h-11 w-11"
        shapeRendering="geometricPrecision"
      >
        <path
          d="M8 30 L20 10 L32 30"
          fill="none"
          stroke="#af915f"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <line x1="8" y1="33" x2="32" y2="33" stroke="#af915f" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
