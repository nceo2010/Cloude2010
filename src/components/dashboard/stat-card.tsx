import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  className?: string;
};

/** A small at-a-glance stat tile, used in a row below the Journey hero. */
export function StatCard({ label, value, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "border-border/60 bg-card rounded-2xl border p-6 shadow-sm dark:shadow-none",
        className,
      )}
    >
      <p className="text-muted-foreground/70 text-xs font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
