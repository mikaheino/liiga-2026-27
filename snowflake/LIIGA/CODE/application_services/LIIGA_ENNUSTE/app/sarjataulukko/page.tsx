// Sarjataulukko välilehtineen: muoto + vire, koti / vieras, maalinteko, erikoistilanteet.
//   /sarjataulukko?nakyma=maalit&joukkue=KooKoo&ikkuna=10&xg=1
// Valinnat luetaan selaimessa (components/Views.tsx), jotta sivu toimii myös Pagesissa.
import Shell from "@/components/Shell";
import { StandingsView } from "@/components/Views";
import { loadLog, loadTeams } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [log, teams] = await Promise.all([loadLog(), loadTeams()]);
  return (
    <Shell active="/sarjataulukko" title="Sarjataulukko">
      <StandingsView log={log} teams={teams} />
    </Shell>
  );
}
