import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-[var(--nsc-canvas)] text-[var(--nsc-ink)]">
      <header className="sticky top-0 z-40 border-b border-[var(--nsc-separator)] bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link href="/staff" className="shrink-0 tracking-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--nsc-secondary)]">
                Nigerian Shippers&apos; Council
              </span>
              <span className="block text-[15px] font-semibold text-[var(--nsc-ink)]">
                Staff ID
              </span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <Link href="/staff" className="nsc-nav-link">
                Staff
              </Link>
              <Link href="/staff?missingPhoto=1" className="nsc-nav-link">
                Photo queue
              </Link>
              <Link href="/import" className="nsc-nav-link">
                Import
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-medium leading-tight">
                {session.user.name}
              </p>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--nsc-secondary)]">
                {session.user.role}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-[var(--nsc-separator)] px-4 py-2 sm:hidden">
          <Link href="/staff" className="nsc-nav-link whitespace-nowrap">
            Staff
          </Link>
          <Link
            href="/staff?missingPhoto=1"
            className="nsc-nav-link whitespace-nowrap"
          >
            Photo queue
          </Link>
          <Link href="/import" className="nsc-nav-link whitespace-nowrap">
            Import
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
