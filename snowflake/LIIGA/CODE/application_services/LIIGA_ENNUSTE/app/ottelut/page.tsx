// Ottelut kuukausittain ja mallin osuvuus. Tämä ja sijaintijakauma ovat ainoat
// paikat joissa mallin toteuma näkyy (CLAUDE.md).
//   /ottelut?kk=2026-10&joukkue=Tappara
import Shell from "@/components/Shell";
import { FixturesView } from "@/components/Views";
import { loadFixtures, loadTeams } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [fixtures, teams] = await Promise.all([loadFixtures(), loadTeams()]);
  return (
    <Shell active="/ottelut" title="Ottelut">
      <FixturesView fixtures={fixtures} teams={teams} />
    </Shell>
  );
}
