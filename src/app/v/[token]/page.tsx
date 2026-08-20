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
        <div className="md-card p-6 text-center">
          <p className="md-body-large text-[var(--md-on-surface-variant)]">
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
        <div className="md-card p-6 text-center">
          <p className="md-body-large text-[var(--md-on-surface-variant)]">
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
        <div className="md-title-small mb-4 rounded-[var(--md-shape-md)] bg-[var(--md-error-container)] px-4 py-3 text-center text-[var(--md-on-error-container)]">
          Suspended — this card is not valid for access
        </div>
      ) : null}

      <div className="space-y-5">
        <div className="text-center">
          <p className="nsc-section-label">Nigerian Shippers&apos; Council</p>
          <p className="md-body-medium mt-1 text-[var(--md-on-surface-variant)]">
            Staff verification
          </p>
        </div>

        <div className="md-card overflow-hidden">
          <div className="flex gap-4 border-b border-[var(--md-outline-variant)] p-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--md-surface-container-high)]">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="md-label-small flex h-full w-full items-center justify-center text-[var(--md-on-surface-variant)]">
                  No photo
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <h1 className="md-title-large leading-tight">{fullName(pub)}</h1>
              <p className="md-label-medium mt-1 uppercase text-[var(--md-on-surface-variant)]">
                {pub.designation}
              </p>
              <p className="md-body-medium mt-2 font-mono">
                ID {pub.idNumber}
              </p>
              <div className="mt-2">
                <span
                  className={`inline-flex h-6 items-center rounded-lg px-2 text-xs font-medium tracking-[0.042em] ${
                    suspended
                      ? "bg-[var(--md-error-container)] text-[var(--md-on-error-container)]"
                      : "bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]"
                  }`}
                >
                  {suspended ? "Suspended" : "Active"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {pub.posting ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Posting" value={pub.posting} />
                {pub.department ? (
                  <Field label="Department" value={pub.department} />
                ) : null}
              </div>
            ) : null}

            {(pub.officeLine || pub.emergencyContactName) && (
              <div className="space-y-3 border-t border-[var(--md-outline-variant)] pt-4 first:border-t-0 first:pt-0">
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
              <div className="grid grid-cols-2 gap-4 border-t border-[var(--md-outline-variant)] pt-4 first:border-t-0 first:pt-0">
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

        <p className="md-body-small text-center">NSC Staff ID verification</p>
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
      <p className="md-label-small uppercase text-[var(--md-on-surface-variant)]">
        {label}
      </p>
      <p
        className={`md-body-medium mt-0.5 text-[var(--md-on-surface)] ${
          mono ? "font-mono" : ""
        } ${strong ? "font-medium" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--md-surface)] px-4 py-10 text-[var(--md-on-surface)]">
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
