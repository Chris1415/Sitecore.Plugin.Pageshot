import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MarketplaceProvider } from "@/components/providers/marketplace";

// T005 — expose Geist Sans + Geist Mono under the canonical --font-sans /
// --font-mono CSS variables expected by Tailwind's fontFamily and by the
// Shutterbug UI spec (§ 4c-4). Next's next/font/google loads Geist from the
// same type foundry as the `geist` npm package; using the Next integration
// keeps font loading zero-config and consistent with the scaffold.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PageShot",
  description: "Capture-screenshot panel for Sitecore Pages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <MarketplaceProvider>{children}</MarketplaceProvider>
      </body>
    </html>
  );
}
