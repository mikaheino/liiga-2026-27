// Pelaajat (5.11.2026): pistepörssi ja maalivahdit. Pelaajan napautus avaa
// pelaajakortin, jossa agentti on sidottu pelaajaan; sivun alalaidassa agentti koko
// liigan pelaajakysymyksille, joilla ei ole yhtä pelaajaa kohteena ('season').
// Data: V_PLAYER_SEASON_NOW / V_GOALIE_SEASON_NOW Snowflakessa, samat kyselyt
// DuckDB:ssä (lib/data.ts loadPlayers). Pagesissa sivu on, agenttia ei.
import CardAgent from "@/components/CardAgent";
import Players from "@/components/Players";
import Shell from "@/components/Shell";
import { loadFixtures, loadPlayerHistory, loadPlayers } from "@/lib/data";
import { STATIC } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ skaters, goalies }, fixtures, hist] = await Promise.all([loadPlayers(), loadFixtures(),
    loadPlayerHistory().catch((e) => { console.log(`[data] pelaajahistoria: ${(e as Error).message}`); return { seasons: {}, used: {} }; })]);
  const season = Math.max(...fixtures.map((f) => f.season ?? 0));
  // Korttiin vain listan pelaajien kaudet (~2 000 riviä, ~60 kt): sivun data, ei agenttia.
  const ids = new Set(skaters.map((p) => p.id));
  const history = {
    seasons: Object.fromEntries(Object.entries(hist.seasons).filter(([id]) => ids.has(Number(id)))),
    used: Object.fromEntries(Object.entries(hist.used).filter(([id]) => ids.has(Number(id)))),
  };
  return (
    <Shell active="/pelaajat" title="Pelaajat" rail={false}>
      <Players skaters={skaters} goalies={goalies} season={season} history={history} />
      {!STATIC && season > 0 && (
        <div className="pl-season">
          <CardAgent subject={{ type: "season", key: `${season}:liiga` }} chips={[]} title="Agentti · koko liiga"
            placeholder="Kysy liigan pelaajista…" />
        </div>
      )}
    </Shell>
  );
}
