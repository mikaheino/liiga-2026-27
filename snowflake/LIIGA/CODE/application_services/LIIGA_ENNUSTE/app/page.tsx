// Etusivu (uusittu 6.11.2026; 7.11. päivän tarina, sitten hakukone-skenaario ylimmäksi,
// heatmap omalle sivulleen /sijainti ja päivän ottelut /ottelut-sivun alkuun, käyttäjä:
// "Muutetaan skenaario Googlemaiseksi liittymäksi ja siirretään heatmap omalle sivulleen
// + päivän ottelut ottelut sivulle"). Kerrokset lukujärjestyksessä:
//   0. Entä jos?          skenaario hakukenttänä, tekoäly rakentaa sen livenä (vain sovellus;
//                         Pagesissa ei agenttia)
//   1. Päivän tarina      viikon suurin nousu (lib/dayStory.ts)
// Kauden kysymykset (valmiit skenaariot) poistettu 7.11. ("Tiputa valmiit skenaariot pois").
// Osioiden ovet yhdellä linkkirivillä puhelimelle (tietokoneella yläpalkki).
import Link from "next/link";
import { DayStory } from "@/components/DayStory";
import ScenarioBoard from "@/components/ScenarioBoard";
import Top, { SECTIONS } from "@/components/Top";
import { loadMeta, loadPosition, loadPositionHistory } from "@/lib/data";
import { dayStory } from "@/lib/dayStory";
import { STATIC } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ meta }, pos, snapsAll] = await Promise.all([
    loadMeta(), loadPosition(),
    loadPositionHistory().catch((e) => { console.log(`[data] jakaumahistoria: ${(e as Error).message}`); return []; }),
  ]);
  const nowDate = String(meta?.UPDATED_AT ?? "").slice(0, 10);
  const story = nowDate ? dayStory(snapsAll, pos, nowDate) : null;

  return (
    <div className="shell">
      <Top updatedAt={meta?.UPDATED_AT} active="/" />
      <main className="main front fr">
        {!STATIC && <ScenarioBoard />}
        <DayStory story={story} />
        <nav className="fr-links phone-only" aria-label="Osiot">
          {SECTIONS.map(([href, label]) => href.startsWith("http")
            ? <a key={href} href={href}>{label}</a>
            : <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </main>
    </div>
  );
}
