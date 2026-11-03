import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

type Parsed<T> = { data: T; error?: never } | { data?: never; error: NextResponse };

/** Human-readable summary of a zod failure, e.g. "firstName: Required". */
export function describeZodError(err: z.ZodError) {
  return err.issues
    .slice(0, 5)
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}

/**
 * Read and validate a JSON body. A missing or malformed body is a 400, not an
 * unhandled exception — `await req.json()` throws on empty/invalid input.
 */
export async function parseJson<S extends z.ZodType>(
  req: NextRequest | Request,
  schema: S,
): Promise<Parsed<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: describeZodError(parsed.error), issues: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}

/** Map known Prisma failures to clean HTTP responses; null when unrecognised. */
export function prismaErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | string | undefined) ?? "";
      const field = Array.isArray(target) ? target.join(", ") : String(target);
      return NextResponse.json(
        {
          error: field.includes("idNumber")
            ? "ID number already exists"
            : `A record with that ${field || "value"} already exists`,
        },
        { status: 409 },
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  return null;
}

/**
 * Trimmed optional text: "" and whitespace become null so the DB never stores
 * blanks. An omitted field stays undefined, so a PATCH leaves it untouched.
 */
export const optionalText = z
  .string()
  .max(500)
  .nullish()
  .transform((v) => {
    if (v === undefined) return undefined;
    const t = v?.trim();
    return t ? t : null;
  });

/** Required trimmed text. */
export const requiredText = z.string().trim().min(1, "Required").max(500);

/**
 * Date-only field from an `<input type="date">` ("2024-05-01") or full ISO
 * string. Prisma rejects bare dates for DateTime columns, so convert here.
 */
export const optionalDate = z
  .string()
  .nullish()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    const t = v?.trim();
    if (!t) return null;
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00.000Z` : t);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

/** IDs are cuids; reject anything else before it reaches a path or query. */
export const ID_PATTERN = /^[a-z0-9]{20,40}$/i;
