// Etusivu (uusittu 6.11.2026; 7.11. hakukone-skenaario ylimmäksi, heatmap /sijainti-sivulle,
// päivän ottelut /ottelut-sivulle, kauden kysymykset ja päivän tarina pois -- käyttäjä:
// "Tiputa valmiit skenaariot pois", päivän tarinasta "tarpeeton"). Jäljellä:
//   Entä jos?   skenaario hakukenttänä, tekoäly rakentaa sen livenä (vain sovellus;
//               Pagesissa ei agenttia: siellä etusivu on components/PagesHome.tsx, 13.11.)
// Osioihin pääsee yläpalkista ja puhelimessa alavalikosta (components/BottomNav.tsx, 13.11.).
import PagesHome from "@/components/PagesHome";
import ScenarioBoard from "@/components/ScenarioBoard";
import Top from "@/components/Top";
import { loadMeta } from "@/lib/data";
import { STATIC } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { meta } = await loadMeta();
  return (
    <div className="shell">
      <Top updatedAt={meta?.UPDATED_AT} active="/" />
      <main className="main front fr">
        {STATIC ? <PagesHome /> : <ScenarioBoard />}
      </main>
    </div>
  );
}
