import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Roboto_Mono, Silkscreen } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import Chat from "@/components/Chat";
import NavTrack from "@/components/NavTrack";
import VersionCheck from "@/components/VersionCheck";
import { AGENT_SOURCE } from "@/lib/agent";
import { STATIC } from "@/lib/target";
import "./globals.css";

// Fontit käännösvaiheessa sovellukseen (next/font): ei ulkoista hakua ajon
// aikana, joten ilme ei riipu verkosta -- Streamlit-versio nojasi Google Fontsiin.
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-hanken" });
const mono = Roboto_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono" });
// NHL 95 -vivahde (käyttäjä 16.10.: "älä liiottele"): pikselifontti vain pieniin
// versaalilappuihin, ei otsikoihin, nimiin eikä lukuihin.
const pixel = Silkscreen({ subsets: ["latin"], weight: ["400"], variable: "--font-pixel" });

export const metadata: Metadata = { title: "Liiga 2026-27 -ennuste", description: "Liigapörssi: sarjataulukko, vire ja ennuste" };
// Puhelin (27.10.): sivu ulottuu lovin ja kotipalkin alle, alavalikko väistää ne
// (env(safe-area-inset-*) globals.css:ssä); selaimen palkki sivun mustana.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#050403" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi" className={`${hanken.variable} ${mono.variable} ${pixel.variable}`}>
      <body>{children}<BottomNav /><NavTrack /><VersionCheck />{!STATIC && <Chat source={AGENT_SOURCE} />}</body>
    </html>
  );
}
