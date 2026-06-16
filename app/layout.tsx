import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400","500","600","700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Lama To-Do",
  description: "Tvůj osobní Kanban + Kalendář s lamou 🦙",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" style={{ fontFamily: fredoka.style.fontFamily }}>
      <body>{children}</body>
    </html>
  );
}
