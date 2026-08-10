import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Template PDFs are loaded at runtime via fs (`design/templates/.../${id}.pdf`),
  // so the file tracer cannot see the paths. Without this, Vercel serverless
  // bundles can omit the artwork and Download PDF diverges from the preview.
  outputFileTracingIncludes: {
    "/api/staff/export": [
      "./design/templates/**/*",
      "./public/fonts/**/*",
    ],
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "sharp",
    "bwip-js",
  ],
};

export default nextConfig;
