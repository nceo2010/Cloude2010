import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** Centered spinner + optional label for pending/async UI. */
export function LoadingState({
  label = "Loading…",
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "text-muted-foreground flex flex-col items-center justify-center gap-3 py-12",
        className,
      )}
    >
      <span
        aria-hidden
        className="border-muted-foreground/30 border-t-foreground size-6 animate-spin rounded-full border-2"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
