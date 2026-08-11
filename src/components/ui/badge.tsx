import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[#f0f0f2] text-[var(--nsc-ink)]",
  success: "bg-[#e8f8ee] text-[#0d4720]",
  warning: "bg-[#fff4e5] text-[#9a5b00]",
  error: "bg-[#ffeceb] text-[#c41e16]",
  info: "bg-[#e8f1ff] text-[#0040dd]",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2 py-0.5
        text-[11px] font-semibold tracking-[0.01em]
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
