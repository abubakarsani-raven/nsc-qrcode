import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseJson } from "@/lib/api";
import {
  renderBatchPdf,
  renderImposedSheet,
  renderStaffCardPdf,
  type StaffCardInput,
} from "@/lib/id-card/render-pdf";
import type { FrontTemplateId, BackTemplateId } from "@/lib/id-card/slots.generated";

/** Rendering is synchronous per card; past this a serverless call can time out. */
/** PDF rendering / image processing can exceed the default 10s on Vercel. */
export const maxDuration = 60;

const MAX_EXPORT = 200;

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one record"),
  mode: z.enum(["single", "batch", "impose-a4", "impose-a3"]).default("batch"),
});

function toInput(s: {
  id: string;
  idNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  designation: string;
  qrToken: string;
  frontTemplate: string;
  backTemplate: string;
  photoOriginalKey: string | null;
  photoCrop: string | null;
  photoPreviewKey: string | null;
  cardTypeScale: string | null;
}): StaffCardInput {
  return {
    ...s,
    frontTemplate: s.frontTemplate as FrontTemplateId,
    backTemplate: s.backTemplate as BackTemplateId,
  };
}

export async function POST(req: NextRequest) {
  const gate = await requirePermission("print");
  if (gate.error) return gate.error;

  const body = await parseJson(req, schema);
  if (body.error) return body.error;

  const ids = [...new Set(body.data.ids)];
  if (ids.length > MAX_EXPORT) {
    return NextResponse.json(
      { error: `Export at most ${MAX_EXPORT} cards at a time — narrow the filters or select rows.` },
      { status: 413 },
    );
  }

  const found = await prisma.staff.findMany({ where: { id: { in: ids } } });
  if (found.length !== ids.length) {
    return NextResponse.json(
      { error: "Some records no longer exist — refresh the list and try again." },
      { status: 404 },
    );
  }
  // Keep the caller's order (the list's sort), not the database's.
  const byId = new Map(found.map((s) => [s.id, s]));
  const staff = ids.map((id) => byId.get(id)!);

  const blocked = staff.filter(
    (s) => s.approvalState !== "APPROVED" || s.hasPendingEdits || s.status === "SUSPENDED",
  );
  if (blocked.length) {
    const n = blocked.length;
    return NextResponse.json(
      {
        error:
          n === staff.length
            ? "None of these cards can be printed yet — they need approval (or are suspended)."
            : `${n} of ${staff.length} cards aren't approved, have unpublished edits, or are suspended. Select only approved cards to print.`,
        blockedIds: blocked.map((b) => b.id),
      },
      { status: 400 },
    );
  }

  const inputs = staff.map(toInput);
  let bytes: Uint8Array;
  if (body.data.mode === "single" && inputs.length === 1) {
    bytes = await renderStaffCardPdf(inputs[0]);
  } else if (body.data.mode === "impose-a4") {
    bytes = await renderImposedSheet(inputs, "A4");
  } else if (body.data.mode === "impose-a3") {
    bytes = await renderImposedSheet(inputs, "A3");
  } else {
    bytes = await renderBatchPdf(inputs);
  }

  const actorId = gate.session.user.id;
  const metadata = JSON.stringify({ mode: body.data.mode });
  await prisma.$transaction([
    prisma.staff.updateMany({ where: { id: { in: ids } }, data: { lastPrintedAt: new Date() } }),
    prisma.auditEvent.createMany({
      data: ids.map((staffId) => ({ actorId, staffId, type: "PRINTED" as const, metadata })),
    }),
  ]);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nsc-id-cards.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
