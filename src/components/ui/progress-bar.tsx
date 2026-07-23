import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  /** 0-100; values outside that range are clamped. */
  value: number;
  className?: string;
  barClassName?: string;
}

/** A simple horizontal progress track. Accent color is caller-controlled via `barClassName`. */
export function ProgressBar({ value, className, barClassName }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("bg-muted h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "bg-primary h-full rounded-full transition-[width] duration-500 ease-out",
          barClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
