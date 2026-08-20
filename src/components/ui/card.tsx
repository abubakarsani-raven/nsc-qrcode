import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
};

/** M3 elevated card: level-1 resting, level-2 on hover. */
export function Card({
  children,
  className = "",
  onClick,
  hoverable = false,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        md-card transition-shadow
        ${hoverable ? "cursor-pointer hover:shadow-[var(--md-elevation-2)]" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div
      className={`border-b border-[var(--md-outline-variant)] px-4 py-4 ${className}`}
    >
      {children}
    </div>
  );
}

type CardBodyProps = {
  children: ReactNode;
  className?: string;
};

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`px-4 py-4 ${className}`}>{children}</div>;
}

type CardFooterProps = {
  children: ReactNode;
  className?: string;
};

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div
      className={`rounded-b-[var(--md-shape-md)] border-t border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)] px-4 py-3 ${className}`}
    >
      {children}
    </div>
  );
}
