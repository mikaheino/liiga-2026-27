// Ottelut kuukausittain ja mallin osuvuus. Tämä ja sijaintijakauma ovat ainoat
// paikat joissa mallin toteuma näkyy (CLAUDE.md).
//   /ottelut?kk=2026-10&joukkue=Tappara
import Shell from "@/components/Shell";
import { FixturesView } from "@/components/Views";
import { fixtureKey, gameKey } from "@/lib/challenger";
import { loadChallenger, loadFixtures, loadTeams } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [all, teams, challenger] = await Promise.all([loadFixtures(), loadTeams(), loadChallenger()]);
  // Haastaja otteluriville: päivän viimeisin kirjaus (sama avain kuin kierroskortissa).
  const ch = new Map(challenger.map((c) => [gameKey(c.date, c.home, c.away), c.pHome]));
  const fixtures = all.map((f) => ({ ...f, chHome: ch.get(fixtureKey(f)) ?? null }));
  return (
    <Shell active="/ottelut" title="Ottelut">
      <FixturesView fixtures={fixtures} teams={teams} />
    </Shell>
  );
}
