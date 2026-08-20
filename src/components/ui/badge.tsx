import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

/** M3 tonal status chip — container colour + its matching "on" colour. */
const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--md-surface-container-high)] text-[var(--md-on-surface-variant)]",
  success:
    "bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]",
  warning:
    "bg-[var(--md-warning-container)] text-[var(--md-on-warning-container)]",
  error: "bg-[var(--md-error-container)] text-[var(--md-on-error-container)]",
  info: "bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)]",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex h-6 items-center rounded-[var(--md-shape-sm)] px-2
        text-xs font-medium tracking-[0.042em]
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
