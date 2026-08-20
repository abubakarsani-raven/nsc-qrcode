import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--md-surface)] px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(13,71,32,0.10), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(13,71,32,0.05), transparent 50%)",
        }}
      />
      <div className="md-card relative w-full max-w-[400px] p-6 shadow-[var(--md-elevation-2)] sm:p-8">
        <p className="nsc-section-label">Nigerian Shippers&apos; Council</p>
        <h1 className="md-headline-small mt-3">Staff ID Portal</h1>
        <p className="md-body-medium mt-2 text-[var(--md-on-surface-variant)]">
          Sign in to manage identity cards and QR verification.
        </p>
        <div className="mt-8">
          <Suspense
            fallback={
              <p className="md-body-medium text-[var(--md-on-surface-variant)]">
                Loading…
              </p>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
