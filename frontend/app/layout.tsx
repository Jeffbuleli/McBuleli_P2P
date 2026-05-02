import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { RegisterServiceWorker } from "./register-sw";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "McBuleli P2P",
  description:
    "Custodial crypto wallet and P2P marketplace for Africa — mobile money, escrow trades, built for DRC.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "McBuleli",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#032b26",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <head />
      <body className="font-sans">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
