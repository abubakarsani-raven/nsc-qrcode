import { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
};

export function Card({ children, className = '', onClick, hoverable = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-lg bg-white border border-neutral-200
        shadow-sm hover:shadow-md transition-shadow duration-150
        ${hoverable ? 'cursor-pointer hover:border-neutral-300' : ''}
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

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-neutral-200 ${className}`}>
      {children}
    </div>
  );
}

type CardBodyProps = {
  children: ReactNode;
  className?: string;
};

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

type CardFooterProps = {
  children: ReactNode;
  className?: string;
};

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`px-6 py-3 border-t border-neutral-200 bg-neutral-50 rounded-b-lg ${className}`}>
      {children}
    </div>
  );
}
