import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/components/I18nProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { RegisterServiceWorker } from "./register-sw";
import "./globals.css";

/** Pas de `next/font/google` ici : sans réseau / proxy, le chargement Google Fonts peut bloquer ou laisser une page blanche en dev. */

export const metadata: Metadata = {
  title: "McBuleli P2P",
  description:
    "Custodial crypto wallet and P2P marketplace for Africa — mobile money, escrow trades, built for DRC.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "McBuleli",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <I18nProvider>
          <ThemeProvider>
            <RegisterServiceWorker />
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
