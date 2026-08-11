import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--nsc-canvas)] px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(13,71,32,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(13,71,32,0.06), transparent 50%)",
        }}
      />
      <div className="relative w-full max-w-[400px] nsc-surface p-8 sm:p-9">
        <p className="nsc-section-label">Nigerian Shippers&apos; Council</p>
        <h1 className="mt-3 text-[28px] font-bold tracking-[-0.03em] text-[var(--nsc-ink)]">
          Staff ID Portal
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--nsc-secondary)]">
          Sign in to manage identity cards and QR verification.
        </p>
        <div className="mt-8">
          <Suspense
            fallback={
              <p className="text-sm text-[var(--nsc-secondary)]">Loading…</p>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
