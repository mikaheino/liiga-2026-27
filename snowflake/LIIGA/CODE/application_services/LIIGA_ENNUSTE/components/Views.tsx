"use client";
// Osiosivujen näkymät, jotka riippuvat URL:n valinnoista (?joukkue=..&ikkuna=..).
// Selaimessa luettavina (useSearchParams), jotta sama koodi toimii sekä Snowflaken
// palvelimella että GitHub Pagesin staattisena vientinä, jossa palvelinta ei ole
// (27.10.). Sivu hakee datan palvelimella / käännöksessä ja antaa sen tänne.
// Palvelimella renderöity sivu saa valinnat jo ensimmäiseen HTML:ään; staattinen
// HTML näyttää oletusnäkymän, kunnes selain lukee valinnat.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { FixtureList, Misses, Months, Score } from "@/components/Fixtures";
import FormTable from "@/components/FormTable";
import History from "@/components/History";
import Kpis from "@/components/Kpis";
import { GoalsTable, SpecialTable, SplitTable } from "@/components/TabTables";
import { type HistoryPoint, TitleHistory, TitleRace, type TitleRow } from "@/components/TitleRace";
import { type Fixture, defaultMonth } from "@/lib/fixtures";
import { type Params, highlightOf, hrefWith } from "@/lib/params";
import { type Game, PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT } from "@/lib/table";

function withUrlParams<P extends { sp: Params }>(Body: (p: P) => ReactNode) {
  function Read(p: Omit<P, "sp">) {
    return <Body {...(p as P)} sp={Object.fromEntries(useSearchParams())} />;
  }
  return function View(p: Omit<P, "sp">) {
    return <Suspense fallback={<Body {...(p as P)} sp={{}} />}><Read {...p} /></Suspense>;
  };
}

const TABS = [["", "Sarjataulukko"], ["koti", "Koti / vieras"], ["maalit", "Maalinteko"], ["erikois", "Erikoistilanteet"]] as const;

export const StandingsView = withUrlParams(({ log, teams, sp }: { log: Game[]; teams: string[]; sp: Params }) => {
  const window = [5, 10, 20].includes(Number(sp.ikkuna)) ? Number(sp.ikkuna) : 10;
  const highlight = highlightOf(sp, teams);
  const view = TABS.some(([k]) => k === sp.nakyma) ? sp.nakyma! : "";
  return (
    <>
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
    </>
  );
});

export const TitleView = withUrlParams(({ title, history, teams, sp }: { title: TitleRow[]; history: HistoryPoint[]; teams: string[]; sp: Params }) => {
  const highlight = highlightOf(sp, teams);
  const top6 = [...title].sort((a, b) => b.pTitle - a.pTitle).slice(0, 6).map((r) => r.team);
  return (
    <>
      <TitleRace rows={title} highlight={highlight} />
      <div className="legend"><span><i className="sw-got" />Kerätty</span><span><i className="sw-sim" />Simuloitu loppukausi</span></div>
      <TitleHistory history={history} top={top6} highlight={highlight} />
    </>
  );
});

export const MotionView = withUrlParams(({ history, order, teams, preseason, sp }: {
  history: HistoryPoint[]; order: string[]; teams: string[]; preseason: Map<string, number>; sp: Params;
}) => <History history={history} order={order} highlight={highlightOf(sp, teams)} preseason={preseason} />);

export const FixturesView = withUrlParams(({ fixtures, teams, sp }: { fixtures: Fixture[]; teams: string[]; sp: Params }) => {
  const highlight = highlightOf(sp, teams);
  const months = [...new Set(fixtures.map((f) => f.start_ts.slice(0, 7)))].sort();
  const month = sp.kk && months.includes(sp.kk) ? sp.kk : defaultMonth(fixtures, new Date().toISOString());
  return (
    <>
      <div className="label-row">
        <Score fixtures={fixtures} />
        <Months months={months} chosen={month} href={(m) => hrefWith("/ottelut", sp, { kk: m }, true)} />
      </div>
      <FixtureList fixtures={fixtures.filter((f) => f.start_ts.startsWith(month))} highlight={highlight} />
      <div className="label sub">Missä malli menee pieleen</div>
      <Misses fixtures={fixtures} highlight={highlight} />
    </>
  );
});
