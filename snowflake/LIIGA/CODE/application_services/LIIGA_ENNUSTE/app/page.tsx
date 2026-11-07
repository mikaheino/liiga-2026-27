// Etusivu (uusittu 6.11.2026; 7.11. hakukone-skenaario ylimmäksi, heatmap /sijainti-sivulle,
// päivän ottelut /ottelut-sivulle, kauden kysymykset ja päivän tarina pois -- käyttäjä:
// "Tiputa valmiit skenaariot pois", päivän tarinasta "tarpeeton"). Jäljellä:
//   Entä jos?   skenaario hakukenttänä, tekoäly rakentaa sen livenä (vain sovellus;
//               Pagesissa ei agenttia, joten siellä etusivulla on vain osiolinkit)
// Osioiden ovet yhdellä linkkirivillä puhelimelle (tietokoneella yläpalkki).
import Link from "next/link";
import ScenarioBoard from "@/components/ScenarioBoard";
import Top, { SECTIONS } from "@/components/Top";
import { loadMeta } from "@/lib/data";
import { STATIC } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { meta } = await loadMeta();
  return (
    <div className="shell">
      <Top updatedAt={meta?.UPDATED_AT} active="/" />
      <main className="main front fr">
        {!STATIC && <ScenarioBoard />}
        <nav className="fr-links phone-only" aria-label="Osiot">
          {SECTIONS.map(([href, label]) => href.startsWith("http")
            ? <a key={href} href={href}>{label}</a>
            : <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </main>
    </div>
  );
}
