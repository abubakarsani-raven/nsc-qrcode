import { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[#0d4720] text-white hover:bg-[#0a3318]
    border border-[#0d4720] hover:border-[#0a3318]
    shadow-sm hover:shadow-md
  `,
  secondary: `
    bg-neutral-100 text-neutral-900 hover:bg-neutral-200
    border border-neutral-200 hover:border-neutral-300
  `,
  danger: `
    bg-red-50 text-red-600 hover:bg-red-100
    border border-red-200 hover:border-red-300
  `,
  ghost: `
    bg-transparent text-neutral-700 hover:bg-neutral-50
    border border-transparent hover:border-neutral-200
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded',
  md: 'px-4 py-2 text-sm font-medium rounded-md',
  lg: 'px-6 py-3 text-base font-semibold rounded-lg',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`
        flex items-center justify-center gap-2
        transition-all duration-150 ease-in-out
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
