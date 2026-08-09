import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-[#f4f6f4]">
      <header className="border-b border-[#0d4720]/15 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/staff" className="font-semibold text-[#0d4720]">
              NSC Staff ID
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/staff" className="text-neutral-700 hover:text-[#0d4720]">
                Staff
              </Link>
              <Link
                href="/staff?missingPhoto=1"
                className="text-neutral-700 hover:text-[#0d4720]"
              >
                Photo queue
              </Link>
              <Link href="/import" className="text-neutral-700 hover:text-[#0d4720]">
                Import
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-600">
              {session.user.name} · {session.user.role}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="rounded-md border px-2 py-1 text-neutral-700 hover:bg-neutral-50">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
