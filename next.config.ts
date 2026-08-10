import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Preview PNGs + Poppins are loaded at runtime via fs for the print raster
  // path. Trace them so Vercel serverless bundles include the same assets the
  // live CardPreview uses.
  outputFileTracingIncludes: {
    "/api/staff/export": [
      "./public/id-card/templates/**/*",
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
