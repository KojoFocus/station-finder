// app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Station Finder",
  description: "Your conversational trotro guide for Accra",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Respect the device's safe area (notch, home bar)
  viewportFit: "cover",
  themeColor: "#0d1a0b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0d1a0b]" suppressHydrationWarning>
        {children}
        <Script id="sw" strategy="afterInteractive">
          {`if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');`}
        </Script>
        <Analytics />
      </body>
    </html>
  );
}
