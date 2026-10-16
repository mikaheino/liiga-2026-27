// Ottelut kuukausittain ja mallin osuvuus. Tämä ja sijaintijakauma ovat ainoat
// paikat joissa mallin toteuma näkyy (CLAUDE.md).
//   /ottelut?kk=2026-10&joukkue=Tappara
import { FixtureList, Misses, Months, Score } from "@/components/Fixtures";
import Shell from "@/components/Shell";
import { type Params, highlightOf, hrefWith, loadFixtures, loadTeams } from "@/lib/data";
import { defaultMonth } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const [fixtures, teams] = await Promise.all([loadFixtures(), loadTeams()]);
  const highlight = highlightOf(sp, teams);
  const months = [...new Set(fixtures.map((f) => f.start_ts.slice(0, 7)))].sort();
  const month = sp.kk && months.includes(sp.kk) ? sp.kk : defaultMonth(fixtures, new Date().toISOString());
  return (
    <Shell active="/ottelut" title="Ottelut">
      <div className="label-row">
        <Score fixtures={fixtures} />
        <Months months={months} chosen={month} href={(m) => hrefWith("/ottelut", sp, { kk: m }, true)} />
      </div>
      <FixtureList fixtures={fixtures.filter((f) => f.start_ts.startsWith(month))} highlight={highlight} />
      <div className="label sub">Missä malli menee pieleen</div>
      <Misses fixtures={fixtures} highlight={highlight} />
    </Shell>
  );
}
