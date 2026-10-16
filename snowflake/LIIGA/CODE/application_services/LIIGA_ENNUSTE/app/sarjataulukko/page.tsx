// Sarjataulukko välilehtineen: muoto + vire, koti / vieras, maalinteko, erikoistilanteet.
//   /sarjataulukko?nakyma=maalit&joukkue=KooKoo&ikkuna=10&xg=1
import Link from "next/link";
import FormTable from "@/components/FormTable";
import Kpis from "@/components/Kpis";
import Shell from "@/components/Shell";
import { GoalsTable, SpecialTable, SplitTable } from "@/components/TabTables";
import { type Params, highlightOf, hrefWith, loadLog, loadTeams } from "@/lib/data";
import { PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT } from "@/lib/table";

export const dynamic = "force-dynamic";
const TABS = [["", "Sarjataulukko"], ["koti", "Koti / vieras"], ["maalit", "Maalinteko"], ["erikois", "Erikoistilanteet"]] as const;

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const [log, teams] = await Promise.all([loadLog(), loadTeams()]);
  const window = [5, 10, 20].includes(Number(sp.ikkuna)) ? Number(sp.ikkuna) : 10;
  const highlight = highlightOf(sp, teams);
  const view = TABS.some(([k]) => k === sp.nakyma) ? sp.nakyma! : "";
  return (
    <Shell active="/sarjataulukko" title="Sarjataulukko">
      <Kpis log={log} teams={teams} window={window} />
      <nav className="tabs" aria-label="Näkymä">
        {TABS.map(([k, label]) => (
          <Link key={k} href={hrefWith("/sarjataulukko", sp, { nakyma: k || null }, true)} scroll={false}
            className={view === k ? "on" : ""} aria-current={view === k ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      {view === "" && <FormTable log={log} teams={teams} window={window} highlight={highlight} showSpark={sp.kayra !== "0"} showXg={sp.xg === "1"} />}
      {view === "koti" && <SplitTable log={log} teams={teams} highlight={highlight} />}
      {view === "maalit" && <GoalsTable log={log} teams={teams} highlight={highlight} />}
      {view === "erikois" && <SpecialTable log={log} teams={teams} highlight={highlight} />}
      <div className="legend">
        {view === "" && <>
          <span><i className="res res-w">V</i>Voitto</span>
          <span><i className="res res-otw">J</i>Jatkoaikavoitto</span>
          <span><i className="res res-otl">H</i>Jatkoaikatappio</span>
          <span><i className="res res-l">H</i>Tappio</span>
        </>}
        <span className={view === "" ? "sep-l" : ""}><i className="zl z-top" />1.–{PLAYOFF_CUT}. puolivälierät</span>
        <span><i className="zl z-quali" />{PLAYOFF_CUT + 1}.–{QUALI_CUT}. karsinta</span>
        <span><i className="zl z-down" />{RELEGATION_CUT + 1}.–17. putoaa</span>
      </div>
    </Shell>
  );
}
