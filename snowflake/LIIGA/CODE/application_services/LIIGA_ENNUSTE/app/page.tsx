// Etusivu (uusittu 6.11.2026; 7.11. hakukone-skenaario ylimmäksi, heatmap /sijainti-sivulle,
// päivän ottelut /ottelut-sivulle, kauden kysymykset ja päivän tarina pois -- käyttäjä:
// "Tiputa valmiit skenaariot pois", päivän tarinasta "tarpeeton"). Jäljellä:
//   Entä jos?   skenaario hakukenttänä, tekoäly rakentaa sen livenä (vain sovellus;
//               Pagesissa ei agenttia: siellä etusivu on components/PagesHome.tsx, 13.11.)
// Osioihin pääsee yläpalkista ja puhelimessa alavalikosta (components/BottomNav.tsx, 13.11.).
import PagesHome from "@/components/PagesHome";
import ScenarioBoard from "@/components/ScenarioBoard";
import Top from "@/components/Top";
import { AGENT_SOURCE } from "@/lib/agent";
import { loadMeta, loadPosition, loadTeams } from "@/lib/data";
import type { Baseline } from "@/lib/scenarioTable";
import { STATIC } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { meta } = await loadMeta();
  // Tarkan näkymän joukkuevalitsin (13.11.2026); Pagesissa ei skenaariota eikä kyselyä.
  const teams = STATIC ? [] : await loadTeams().catch(() => [] as string[]);
  // Skenaarion lopputaulukon pohja ennen ensimmäistä lukitusta (13.11.2026, components/ScenarioTable.tsx):
  // julkaistu ennuste samoina todennäköisyyksinä kuin moottorin *_now-sarakkeet (sijajakaumasta).
  const sum = (p: number[], a: number, b: number) => p.slice(a, b).reduce((s, x) => s + x, 0);
  // Sija pisteiden mukaan kuten moottorin rank_now (simulate_scenario.py _team_rows), jotta ensimmäinen
  // lukitus ei näytä sijamuutosta, joka johtuu vain eri järjestyssäännöstä.
  const baseline: Baseline[] = STATIC ? [] : await loadPosition().then((pos) => [...pos].sort((a, b) => b.points - a.points).map((r, i) => ({
    team: r.team, rank: i + 1, points: r.points,
    top10: sum(r.p, 0, 10), top6: sum(r.p, 0, 6), rel: sum(r.p, 14, 17), title: r.pTitle / 100,
  }))).catch(() => [] as Baseline[]);
  return (
    <div className="shell">
      <Top updatedAt={meta?.UPDATED_AT} active="/" />
      <main className="main front fr">
        {STATIC ? <PagesHome /> : <ScenarioBoard source={AGENT_SOURCE} teams={teams} baseline={baseline} />}
      </main>
    </div>
  );
}
