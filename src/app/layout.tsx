import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { Providers } from "@/components/providers";
import { MuiProvider } from "@/components/mui-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "NSC Staff ID Portal",
  description: "Nigerian Shippers' Council staff identity card and QR verification",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <MuiProvider>
            <Providers>{children}</Providers>
          </MuiProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
