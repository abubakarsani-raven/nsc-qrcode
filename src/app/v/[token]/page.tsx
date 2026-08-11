import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { fullName } from "@/lib/staff";

type Ctx = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Staff verification",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({ params }: Ctx) {
  const { token } = await params;
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return (
      <Shell>
        <div className="nsc-surface p-6 text-center">
          <p className="text-[15px] text-[var(--nsc-secondary)]">
            This verification link is not available.
          </p>
        </div>
      </Shell>
    );
  }

  const staff = await prisma.staff.findUnique({
    where: { qrToken: token },
    include: { published: true },
  });

  if (!staff?.published) {
    return (
      <Shell>
        <div className="nsc-surface p-6 text-center">
          <p className="text-[15px] text-[var(--nsc-secondary)]">
            This verification link is not available.
          </p>
        </div>
      </Shell>
    );
  }

  const pub = staff.published;
  const suspended = staff.status === "SUSPENDED";
  const photo = pub.photoPreviewKey
    ? `/api/photos/${staff.id}/${pub.photoPreviewKey}?token=${encodeURIComponent(token)}`
    : null;

  return (
    <Shell>
      {suspended ? (
        <div className="mb-4 rounded-2xl bg-[#ff3b30]/10 px-4 py-3 text-center text-[13px] font-semibold text-[#c41e16]">
          Suspended — this card is not valid for access
        </div>
      ) : null}

      <div className="space-y-5">
        <div className="text-center">
          <p className="nsc-section-label">Nigerian Shippers&apos; Council</p>
          <p className="mt-1 text-[13px] text-[var(--nsc-secondary)]">
            Staff verification
          </p>
        </div>

        <div className="nsc-surface overflow-hidden">
          <div className="flex gap-4 border-b border-[var(--nsc-separator)] p-5">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--nsc-fill)] ring-2 ring-[var(--nsc-separator)]">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--nsc-secondary)]">
                  No photo
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-[var(--nsc-ink)]">
                {fullName(pub)}
              </h1>
              <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--nsc-secondary)]">
                {pub.designation}
              </p>
              <p className="mt-2 font-mono text-[13px] text-[var(--nsc-ink)]">
                ID {pub.idNumber}
              </p>
              <div className="mt-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    suspended
                      ? "bg-[#ff3b30]/12 text-[#c41e16]"
                      : "bg-[#34c759]/15 text-[var(--nsc-green)]"
                  }`}
                >
                  {suspended ? "Suspended" : "Active"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5 text-[13px]">
            {pub.posting ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Posting" value={pub.posting} />
                {pub.department ? (
                  <Field label="Department" value={pub.department} />
                ) : null}
              </div>
            ) : null}

            {(pub.officeLine || pub.emergencyContactName) && (
              <div className="space-y-3 border-t border-[var(--nsc-separator)] pt-4">
                {pub.officeLine ? (
                  <Field label="Office line" value={pub.officeLine} mono />
                ) : null}
                {pub.emergencyContactName ? (
                  <Field
                    label="Emergency contact"
                    value={`${pub.emergencyContactName}${
                      pub.emergencyContactPhone
                        ? ` · ${pub.emergencyContactPhone}`
                        : ""
                    }`}
                  />
                ) : null}
              </div>
            )}

            {(pub.bloodGroup || pub.genotype) && (
              <div className="grid grid-cols-2 gap-4 border-t border-[var(--nsc-separator)] pt-4">
                {pub.bloodGroup ? (
                  <Field label="Blood group" value={pub.bloodGroup} strong />
                ) : null}
                {pub.genotype ? (
                  <Field label="Genotype" value={pub.genotype} strong />
                ) : null}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[12px] text-[var(--nsc-secondary)]">
          NSC Staff ID verification
        </p>
      </div>
    </Shell>
  );
}

function Field({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--nsc-secondary)]">
        {label}
      </p>
      <p
        className={`mt-0.5 text-[var(--nsc-ink)] ${mono ? "font-mono" : ""} ${
          strong ? "font-semibold" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--nsc-canvas)] px-4 py-10 text-[var(--nsc-ink)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(13,71,32,0.10), transparent 55%)",
        }}
      />
      <div className="relative mx-auto max-w-sm">{children}</div>
    </div>
  );
}
