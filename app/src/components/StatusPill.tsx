import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/40 bg-red-400/10 text-red-300",
  active: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  frozen: "border-sky-400/40 bg-sky-400/10 text-sky-300",
};

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em]",
        styles[status] ?? "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
