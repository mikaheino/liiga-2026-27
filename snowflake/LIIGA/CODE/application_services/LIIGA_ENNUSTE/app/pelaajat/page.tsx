// Pelaajat (5.11.2026): pistepörssi ja maalivahdit. Pelaajan napautus avaa
// pelaajakortin, jossa agentti on sidottu pelaajaan; sivun alalaidassa agentti koko
// liigan pelaajakysymyksille, joilla ei ole yhtä pelaajaa kohteena ('season').
// Data: V_PLAYER_SEASON_NOW / V_GOALIE_SEASON_NOW Snowflakessa, samat kyselyt
// DuckDB:ssä (lib/data.ts loadPlayers). Pagesissa sivu on, agenttia ei.
import CardAgent from "@/components/CardAgent";
import Players from "@/components/Players";
import Shell from "@/components/Shell";
import { loadFixtures, loadPlayers } from "@/lib/data";
import { STATIC } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ skaters, goalies }, fixtures] = await Promise.all([loadPlayers(), loadFixtures()]);
  const season = Math.max(...fixtures.map((f) => f.season ?? 0));
  return (
    <Shell active="/pelaajat" title="Pelaajat" rail={false}>
      <Players skaters={skaters} goalies={goalies} season={season} />
      {!STATIC && season > 0 && (
        <div className="pl-season">
          <CardAgent subject={{ type: "season", key: `${season}:liiga` }} chips={[]} title="Agentti · koko liiga"
            placeholder="Kysy liigan pelaajista…" />
        </div>
      )}
    </Shell>
  );
}
