import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Ma Zone — Livré dans l'heure",
    template: "%s · Ma Zone",
  },
  description:
    "Trouvez ce dont vous avez besoin autour de vous. Livré dans l'heure par un commerçant de votre ville.",
  applicationName: "Ma Zone",
  openGraph: {
    title: "Ma Zone — Livré dans l'heure",
    description:
      "Pourquoi attendre demain ce qui est déjà dans votre zone ? Trouvez un produit autour de vous et faites-vous livrer immédiatement.",
    url: appUrl,
    siteName: "Ma Zone",
    locale: "fr_FR",
    type: "website",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f2d5c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
