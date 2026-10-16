import type { Metadata } from "next";
import { Hanken_Grotesk, Roboto_Mono } from "next/font/google";
import "./globals.css";

// Fontit käännösvaiheessa sovellukseen (next/font): ei ulkoista hakua ajon
// aikana, joten ilme ei riipu verkosta -- Streamlit-versio nojasi Google Fontsiin.
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-hanken" });
const mono = Roboto_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono" });

export const metadata: Metadata = { title: "Liiga 2026-27 -ennuste", description: "Liigapörssi: sarjataulukko, vire ja ennuste" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi" className={`${hanken.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
