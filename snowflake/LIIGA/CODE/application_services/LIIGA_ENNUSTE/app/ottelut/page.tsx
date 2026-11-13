// Ottelut kuukausittain ja mallin osuvuus. Tämä ja sijaintijakauma ovat ainoat
// paikat joissa mallin toteuma näkyy (CLAUDE.md).
//   /ottelut?kk=2026-10&joukkue=Tappara
// Alussa päivän ottelut (7.11.2026, siirretty etusivulta): ratkaisupeli ja seuraava kierros.
import { KeyGame } from "@/components/DayStory";
import NextRound from "@/components/NextRound";
import Shell from "@/components/Shell";
import { FixturesView } from "@/components/Views";
import { fixtureKey, gameKey } from "@/lib/challenger";
import { loadChallenger, loadChallengerSeason, loadFixtures, loadNews, loadStakes, loadTeams } from "@/lib/data";
import { nextRound } from "@/lib/fixtures";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ottelut" };

export default async function Page() {
  const [all, teams, challenger, season, news, stakeList] = await Promise.all([
    loadFixtures(), loadTeams(), loadChallenger(), loadChallengerSeason(), loadNews(),
    // Puuttuva panosmoottori ei kaada sivua.
    loadStakes().catch((e) => { console.log(`[data] panokset: ${(e as Error).message}`); return []; }),
  ]);
  // Haastaja otteluriville: päivän viimeisin kirjaus (sama avain kuin kierroskortissa).
  const ch = new Map(challenger.map((c) => [gameKey(c.date, c.home, c.away), c.pHome]));
  const fixtures = all.map((f) => ({ ...f, chHome: ch.get(fixtureKey(f)) ?? null }));
  // Kierroskorttiin: päivän ajo (maalivahdit + poissaolot) ohittaa kausiennusteen
  // otteluarvion (vain poissaolot), joka kattaa myös tulevat päivät.
  const chMap = new Map(season.games.map((g) => [gameKey(g.date, g.home, g.away),
    { date: g.date, home: g.home, away: g.away, base: NaN, pHome: g.pHome, pOt: NaN, notes: g.notes }]));
  for (const c of challenger) chMap.set(gameKey(c.date, c.home, c.away), c);
  const stakes = new Map(stakeList.map((s) => [s.game_id, s]));
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const round = nextRound(all, today);
  return (
    <Shell active="/ottelut" title="Ottelut">
      <div className="ot-today">
        <KeyGame games={round} stakes={stakes} all={all} news={news.items} challenger={chMap} />
        <NextRound games={round} challenger={chMap} all={all} news={news.items} stakes={stakes} />
      </div>
      <FixturesView fixtures={fixtures} teams={teams} />
    </Shell>
  );
}
