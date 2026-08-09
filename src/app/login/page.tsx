import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#e8f2ea,#f7f7f5_55%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#0d4720]/15 bg-white/90 p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0d4720]/70">
          Nigerian Shippers&apos; Council
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#0d4720]">
          Staff ID Portal
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Sign in to manage staff identity cards and QR verification.
        </p>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
