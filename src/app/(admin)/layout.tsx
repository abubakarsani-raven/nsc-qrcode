import { Suspense } from "react";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminNavLinks } from "@/components/admin-nav-links";

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
            <Suspense fallback={<div className="hidden h-8 w-48 sm:block" />}>
              <AdminNavLinks className="hidden items-center gap-1 sm:flex" />
            </Suspense>
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
        <Suspense fallback={<div className="h-10 sm:hidden" />}>
          <AdminNavLinks className="flex gap-1 overflow-x-auto border-t border-[var(--nsc-separator)] px-4 py-2 sm:hidden" />
        </Suspense>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
