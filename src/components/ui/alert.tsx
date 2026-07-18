import * as React from "react";

import { cn } from "@/lib/utils";

type AlertVariant = "default" | "destructive" | "success" | "warning";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const variantClasses: Record<AlertVariant, string> = {
  default: "bg-card text-card-foreground border-border",
  destructive:
    "border-destructive/50 text-destructive [&_[data-alert-title]]:text-destructive",
  success: "border-success/50 text-success",
  warning: "border-warning/50 text-warning",
};

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "w-full rounded-lg border px-4 py-3 text-sm",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      data-alert-title
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div className={cn("text-sm opacity-90", className)} {...props} />
  );
}
