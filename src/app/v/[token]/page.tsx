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
        <div className="rounded-lg bg-white p-6 text-center">
          <p className="text-neutral-600">This verification link is not available.</p>
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
        <div className="rounded-lg bg-white p-6 text-center">
          <p className="text-neutral-600">This verification link is not available.</p>
        </div>
      </Shell>
    );
  }

  const pub = staff.published;
  const suspended = staff.status === "SUSPENDED";
  const photo =
    pub.photoPreviewKey
      ? `/api/photos/${staff.id}/${pub.photoPreviewKey}?token=${encodeURIComponent(token)}`
      : null;

  return (
    <Shell>
      {suspended ? (
        <div className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-center text-sm font-semibold text-red-800">
          ⚠ SUSPENDED — This card is not valid for access
        </div>
      ) : null}
      
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0d4720]/70">
            Nigerian Shippers&apos; Council
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Staff Verification</p>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-[#0d4720]/10 bg-white p-5 shadow-sm">
          {/* Photo & Name */}
          <div className="flex gap-4 pb-4 border-b border-neutral-100">
            <div className="h-24 w-24 flex-shrink-0 rounded-full border-2 border-[#d3dcf1] bg-neutral-100 overflow-hidden">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-neutral-400">
                  No photo
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <h1 className="font-bold text-sm text-[#0d4720] leading-tight">
                {fullName(pub)}
              </h1>
              <p className="text-xs uppercase text-neutral-600 mt-1">
                {pub.designation}
              </p>
              <p className="text-xs font-mono text-neutral-700 mt-2">
                ID {pub.idNumber}
              </p>
              <div className="mt-2">
                <span
                  className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${
                    suspended
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {suspended ? "SUSPENDED" : "ACTIVE"}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="space-y-3 pt-4">
            {pub.posting && (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-neutral-500 font-medium">Posting</p>
                  <p className="mt-0.5 text-neutral-800">{pub.posting}</p>
                </div>
                {pub.department && (
                  <div>
                    <p className="text-neutral-500 font-medium">Department</p>
                    <p className="mt-0.5 text-neutral-800">{pub.department}</p>
                  </div>
                )}
              </div>
            )}

            {/* Contact Info */}
            <div className="space-y-2 text-xs border-t border-neutral-100 pt-3">
              {pub.officeLine && (
                <div>
                  <p className="text-neutral-500 font-medium">Office Line</p>
                  <p className="mt-0.5 font-mono text-neutral-800">{pub.officeLine}</p>
                </div>
              )}
              {pub.emergencyContactName && (
                <div>
                  <p className="text-neutral-500 font-medium">Emergency Contact</p>
                  <p className="mt-0.5 text-neutral-800">
                    {pub.emergencyContactName}
                    {pub.emergencyContactPhone ? ` · ${pub.emergencyContactPhone}` : ""}
                  </p>
                </div>
              )}
            </div>

            {/* Health Info */}
            {(pub.bloodGroup || pub.genotype) && (
              <div className="grid grid-cols-2 gap-4 text-xs border-t border-neutral-100 pt-3">
                {pub.bloodGroup && (
                  <div>
                    <p className="text-neutral-500 font-medium">Blood Group</p>
                    <p className="mt-0.5 font-semibold text-neutral-800">{pub.bloodGroup}</p>
                  </div>
                )}
                {pub.genotype && (
                  <div>
                    <p className="text-neutral-500 font-medium">Genotype</p>
                    <p className="mt-0.5 font-semibold text-neutral-800">{pub.genotype}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-neutral-400">
          NSC Staff ID Verification Portal
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 px-4 py-8">
      <div className="mx-auto max-w-sm">{children}</div>
    </div>
  );
}
