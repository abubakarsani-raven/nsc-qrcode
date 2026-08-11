import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
};

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
        nsc-surface
        ${hoverable ? "cursor-pointer transition-transform hover:-translate-y-0.5" : ""}
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
      className={`border-b border-[var(--nsc-separator)] px-5 py-4 ${className}`}
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
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

type CardFooterProps = {
  children: ReactNode;
  className?: string;
};

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div
      className={`rounded-b-[1rem] border-t border-[var(--nsc-separator)] bg-[#fafafa] px-5 py-3 ${className}`}
    >
      {children}
    </div>
  );
}
