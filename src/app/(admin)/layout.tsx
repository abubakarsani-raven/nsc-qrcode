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
    <div className="min-h-screen bg-[var(--md-surface)] text-[var(--md-on-surface)]">
      {/* M3 small top app bar — surface container, no rule, 64dp */}
      <header className="sticky top-0 z-40 bg-[var(--md-surface-container)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link href="/staff" className="shrink-0">
              <span className="md-label-small block uppercase text-[var(--md-on-surface-variant)]">
                Nigerian Shippers&apos; Council
              </span>
              <span className="md-title-large block">Staff ID</span>
            </Link>
            <Suspense fallback={<div className="hidden h-10 w-48 sm:block" />}>
              <AdminNavLinks className="hidden items-center gap-1 sm:flex" />
            </Suspense>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden text-right sm:block">
              <p className="md-label-large leading-tight">
                {session.user.name}
              </p>
              <p className="md-label-small uppercase text-[var(--md-on-surface-variant)]">
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
        <Suspense fallback={<div className="h-12 sm:hidden" />}>
          <AdminNavLinks className="flex gap-2 overflow-x-auto px-4 pb-3 sm:hidden" />
        </Suspense>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
