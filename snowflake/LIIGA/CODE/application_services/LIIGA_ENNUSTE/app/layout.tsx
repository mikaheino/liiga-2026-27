import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Roboto_Mono, Silkscreen } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import Chat from "@/components/Chat";
import Kiekko from "@/components/Kiekko";
import NavTrack from "@/components/NavTrack";
import VersionCheck from "@/components/VersionCheck";
import { AGENT_SOURCE } from "@/lib/agent";
import { BASE, STATIC } from "@/lib/target";
import "./globals.css";

// Fontit käännösvaiheessa sovellukseen (next/font): ei ulkoista hakua ajon
// aikana, joten ilme ei riipu verkosta -- Streamlit-versio nojasi Google Fontsiin.
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-hanken" });
const mono = Roboto_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono" });
// NHL 95 -vivahde (käyttäjä 16.10.: "älä liiottele"): pikselifontti vain pieniin
// versaalilappuihin, ei otsikoihin, nimiin eikä lukuihin.
const pixel = Silkscreen({ subsets: ["latin"], weight: ["400"], variable: "--font-pixel" });

// Jakokortti ja kuvakkeet (13.11.2026): linkki näkyy viestissä otsikolla ja kuvalla.
// Kuvake: app/icon.svg ja app/apple-icon.png (Nextin tiedostokäytäntö), jakokuva public/og.png.
// Osoite vain Pagesissa: jakokuvan on oltava täysi URL, ja sovelluksen osoite ei ole julkinen.
const DESCRIPTION = "Liigan runkosarjan 2026–27 ennuste: illan ottelut, ennustettu lopputaulukko ja voittaja, päivitetään joka päivä.";
export const metadata: Metadata = {
  title: { default: "Liiga Ennuste 2026–27", template: "%s · Liiga Ennuste" },
  description: DESCRIPTION,
  applicationName: "Liiga Ennuste",
  appleWebApp: { capable: true, title: "Liiga Ennuste", statusBarStyle: "black-translucent" },
  ...(STATIC ? {
    metadataBase: new URL("https://mikaheino.github.io"),
    openGraph: { type: "website", locale: "fi_FI", siteName: "Liiga Ennuste", title: "Liiga Ennuste 2026–27", description: DESCRIPTION,
      url: `${BASE}/`, images: [{ url: `${BASE}/og.png`, width: 1200, height: 630, alt: "Liiga Ennuste, runkosarja 2026–27" }] },
    twitter: { card: "summary_large_image", title: "Liiga Ennuste 2026–27", description: DESCRIPTION, images: [`${BASE}/og.png`] },
  } : {}),
};
// Puhelin (27.10.): sivu ulottuu lovin ja kotipalkin alle, alavalikko väistää ne
// (env(safe-area-inset-*) globals.css:ssä); selaimen palkki sivun mustana.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#050403" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi" className={`${hanken.variable} ${mono.variable} ${pixel.variable}`}>
      {/* Vapaa keskustelu ilman kelluvaa nappia (6.11.): avataan navigaation Kysy-kohdasta
          tai kortin "Jatka keskustelua" -rivistä (lib/chatBus.ts). Pagesissa ei agenttia. */}
      <body>{children}<BottomNav /><NavTrack /><VersionCheck />{!STATIC && <Chat source={AGENT_SOURCE} />}{!STATIC && <Kiekko />}</body>
    </html>
  );
}
