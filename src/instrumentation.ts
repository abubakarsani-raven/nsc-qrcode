/**
 * Runs once when the Node server boots (Vercel serverless cold start / `next start`).
 * Keeps roles + sample staff present even if build-time seed was skipped.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SKIP_DB_SEED === "1") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[instrumentation] DATABASE_URL missing — skip seed");
    return;
  }

  try {
    const { seedDatabase } = await import("@/lib/db-seed");
    const result = await seedDatabase();
    console.log(
      `[instrumentation] seed ok — admin ${result.adminEmail}`,
    );
  } catch (err) {
    // Don't crash the app on seed failure (e.g. DB waking up); next request can retry.
    console.error("[instrumentation] seed failed:", err);
  }
}
