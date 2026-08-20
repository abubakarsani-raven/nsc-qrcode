"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/staff", label: "Staff", match: (path: string, missing: boolean) => path.startsWith("/staff") && !missing },
  {
    href: "/staff?missingPhoto=1",
    label: "Photo queue",
    match: (_path: string, missing: boolean) => missing,
  },
  { href: "/import", label: "Import", match: (path: string) => path.startsWith("/import") },
] as const;

export function AdminNavLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const missing = sp.get("missingPhoto") === "1";

  return (
    <nav className={className}>
      {LINKS.map((link) => {
        const active = link.match(pathname, missing);
        return (
          <Link
            key={link.href}
            href={link.href}
            className="md-nav-link whitespace-nowrap"
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
