import type { Metadata } from "next";
import { Caveat, DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-display", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-handwritten", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Posting Art",
  description: "Prepare artwork photos for Instagram and Facebook without cropping the art.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${dmSans.variable} ${fraunces.variable} ${caveat.variable}`}>{children}</body></html>;
}
