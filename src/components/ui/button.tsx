import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Material Design 3 common buttons.
 * `default` = filled, `secondary` = filled tonal, `outline` = outlined,
 * `ghost` = text, plus a tonal error button and a plain link.
 * Hover/press use M3 state layers (8% / 10% of the label colour).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-sm font-medium tracking-[0.007em] whitespace-nowrap transition-[background-color,box-shadow,color] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--md-primary)] disabled:pointer-events-none aria-invalid:outline-2 aria-invalid:outline-[var(--md-error)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        // Filled
        default:
          "bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:bg-[color-mix(in_srgb,var(--md-on-primary)_8%,var(--md-primary))] hover:shadow-[var(--md-elevation-1)] active:bg-[color-mix(in_srgb,var(--md-on-primary)_10%,var(--md-primary))] active:shadow-none disabled:bg-[color-mix(in_srgb,var(--md-on-surface)_12%,transparent)] disabled:text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)] disabled:shadow-none",
        // Outlined
        outline:
          "border-[var(--md-outline)] bg-transparent text-[var(--md-primary)] hover:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)] aria-expanded:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)] disabled:border-[color-mix(in_srgb,var(--md-on-surface)_12%,transparent)] disabled:text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]",
        // Filled tonal
        secondary:
          "bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)] hover:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_8%,var(--md-secondary-container))] hover:shadow-[var(--md-elevation-1)] active:shadow-none aria-expanded:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_10%,var(--md-secondary-container))] disabled:bg-[color-mix(in_srgb,var(--md-on-surface)_12%,transparent)] disabled:text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)] disabled:shadow-none",
        // Text
        ghost:
          "text-[var(--md-primary)] hover:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)] aria-expanded:bg-[color-mix(in_srgb,var(--md-primary)_10%,transparent)] disabled:text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]",
        // Tonal error
        destructive:
          "bg-[var(--md-error-container)] text-[var(--md-on-error-container)] hover:bg-[color-mix(in_srgb,var(--md-on-error-container)_8%,var(--md-error-container))] focus-visible:outline-[var(--md-error)] active:bg-[color-mix(in_srgb,var(--md-on-error-container)_10%,var(--md-error-container))] disabled:bg-[color-mix(in_srgb,var(--md-on-surface)_12%,transparent)] disabled:text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]",
        link: "text-[var(--md-primary)] underline-offset-4 hover:underline disabled:text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]",
      },
      size: {
        // M3 buttons are 40dp tall with 24dp side padding
        default: "h-10 px-6 has-data-[icon=inline-start]:pl-4 has-data-[icon=inline-end]:pr-4",
        xs: "h-7 px-3 text-xs [&_svg:not([class*='size-'])]:size-4",
        sm: "h-8 px-4 text-[13px] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 px-8 text-base",
        icon: "size-10 px-0",
        "icon-xs": "size-7 px-0 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-8 px-0 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
