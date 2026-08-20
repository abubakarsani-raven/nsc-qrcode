import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import {
  renderBatchPdf,
  renderImposedSheet,
  renderStaffCardPdf,
  type StaffCardInput,
} from "@/lib/id-card/render-pdf";
import type { FrontTemplateId, BackTemplateId } from "@/lib/id-card/slots.generated";

const schema = z.object({
  ids: z.array(z.string()).min(1),
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
  if ("error" in gate && gate.error) return gate.error;

  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const staff = await prisma.staff.findMany({
    where: { id: { in: body.data.ids } },
  });

  if (staff.length !== body.data.ids.length) {
    return NextResponse.json({ error: "Some staff not found" }, { status: 404 });
  }

  const blocked = staff.filter(
    (s) => s.approvalState !== "APPROVED" || s.hasPendingEdits,
  );
  if (blocked.length) {
    return NextResponse.json(
      {
        error: "Only approved records without pending edits can be printed",
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

  await prisma.staff.updateMany({
    where: { id: { in: body.data.ids } },
    data: { lastPrintedAt: new Date() },
  });

  for (const s of staff) {
    await audit(gate.session!.user.id, "PRINTED", s.id, { mode: body.data.mode });
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nsc-id-cards.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
