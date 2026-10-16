// Liiga Ennuste. Osiot ylhäältä alas: kauden tilanne, sijaintijakauma,
// sarjataulukko välilehtineen, runkosarjan voittaja, ottelut ja mallin osuvuus,
// ennusteen liike. Minimalismi (käyttäjä 16.10.): ei ingressejä eikä
// alaviitteitä -- osion nimi korkeintaan yhtenä hiljaisena rivinä.
//
// Kaikki valinnat ovat URL-parametreja, jotta agentti voi linkittää näkymään:
//   /?joukkue=KooKoo,Jokerit&ikkuna=10&kayra=0&xg=1&nakyma=maalit&kk=2026-10
import Link from "next/link";
import { Suspense } from "react";
import Controls from "@/components/Controls";
import { FixtureList, Misses, Months, Score } from "@/components/Fixtures";
import FormTable from "@/components/FormTable";
import Heatmap, { type PositionRow } from "@/components/Heatmap";
import History from "@/components/History";
import Kpis from "@/components/Kpis";
import { Reveal } from "@/components/Motion";
import Season from "@/components/Season";
import { GoalsTable, SpecialTable, SplitTable } from "@/components/TabTables";
import { type HistoryPoint, TitleHistory, TitleRace } from "@/components/TitleRace";
import Top from "@/components/Top";
import { type Fixture, defaultMonth } from "@/lib/fixtures";
import { query } from "@/lib/snowflake";
import { type Game, PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT } from "@/lib/table";

export const dynamic = "force-dynamic";   // tuore data joka latauksella

type Params = Record<string, string | undefined>;
const M = "LIIGA.MODEL";
const num = (v: unknown) => (v == null ? null : Number(v));

async function load() {
  const [log, teams, meta, pos, next, hist, fx] = await Promise.all([
    query(`
      SELECT team, start_ts, points, goals_for, goals_against, xg_for, xg_against,
             is_home, pp_goals, pp_instances, sh_instances, pp_goals_against
      FROM ${M}.TEAM_GAME_LOG
      WHERE season = (SELECT MAX(season) FROM ${M}.TEAM_GAME_LOG)
      ORDER BY team, start_ts`),
    query<{ TEAM: string }>(`
      SELECT DISTINCT home_team AS team FROM ${M}.STG_GAMES
      WHERE season = (SELECT MAX(season) FROM ${M}.STG_GAMES) ORDER BY 1`),
    query<{ UPDATED_AT: string; GAMES_PLAYED: number; GAMES_TOTAL: number }>(
      `SELECT updated_at, games_played, games_total FROM ${M}.PREDICTION_META`),
    query(`
      SELECT s.team, s.proj_rank, s.mean_points, s.p05_points, s.p95_points, s.p_title, p.*
      FROM ${M}.STANDINGS_2026_27 s
      JOIN ${M}.POSITION_DISTRIBUTION_2026_27 p ON p.team = s.team
      ORDER BY s.proj_rank`),
    query<{ D: string; N: number }>(`
      SELECT TO_CHAR(MIN(game_date), 'YYYY-MM-DD') AS d,
             COUNT_IF(game_date = (SELECT MIN(game_date) FROM ${M}.V_UPCOMING_PREDICTIONS)) AS n
      FROM ${M}.V_UPCOMING_PREDICTIONS`),
    query(`SELECT team, snapshot_date, mean_points, p_title, games_played FROM ${M}.PREDICTION_HISTORY ORDER BY snapshot_date`),
    // Sama liitos kuin streamlit_app.py:n fixtures_sql: uusin snapshot
    // ottelupäivänä tai ennen -- se mitä malli sanoi ennen kiekon pudotusta.
    query(`
      SELECT g.start_ts, g.home_team, g.away_team, g.ended, g.home_goals, g.away_goals,
             g.result_category, p.p_home_win, p.p_overtime
      FROM ${M}.STG_GAMES g
      LEFT JOIN ${M}.PREDICTION_GAMES p ON p.game_id = g.game_id
           AND p.snapshot_date = (SELECT MAX(p2.snapshot_date) FROM ${M}.PREDICTION_GAMES p2
                                  WHERE p2.game_id = g.game_id AND p2.snapshot_date <= SUBSTR(g.start_ts, 1, 10))
      WHERE g.season = (SELECT MAX(season) FROM ${M}.STG_GAMES)
      ORDER BY g.start_ts, g.home_team`),
  ]);
  const games: Game[] = log.map((r) => ({
    team: String(r.TEAM), start_ts: String(r.START_TS), points: Number(r.POINTS),
    goals_for: Number(r.GOALS_FOR), goals_against: Number(r.GOALS_AGAINST), xg_for: num(r.XG_FOR), xg_against: num(r.XG_AGAINST),
    is_home: Boolean(r.IS_HOME), pp_goals: Number(r.PP_GOALS ?? 0), pp_instances: Number(r.PP_INSTANCES ?? 0),
    sh_instances: Number(r.SH_INSTANCES ?? 0), pp_goals_against: Number(r.PP_GOALS_AGAINST ?? 0),
  }));
  const position: PositionRow[] = pos.map((r) => ({
    team: String(r.TEAM), projRank: Number(r.PROJ_RANK), points: Number(r.MEAN_POINTS),
    p05: Number(r.P05_POINTS), p95: Number(r.P95_POINTS),
    p: Array.from({ length: 17 }, (_, i) => Number(r[`RANK_${i + 1}`] ?? 0)),
  }));
  const banked = new Map<string, number>();
  for (const g of games) banked.set(g.team, (banked.get(g.team) ?? 0) + g.points);
  const title = pos.map((r) => ({ team: String(r.TEAM), pTitle: 100 * Number(r.P_TITLE), points: Number(r.MEAN_POINTS), banked: banked.get(String(r.TEAM)) ?? 0 }));
  const history: HistoryPoint[] = hist.map((r) => ({
    team: String(r.TEAM), date: String(r.SNAPSHOT_DATE).slice(0, 10), points: Number(r.MEAN_POINTS),
    pTitle: 100 * Number(r.P_TITLE), games: Number(r.GAMES_PLAYED),
  }));
  // Esikauden vertailukohta = viimeisin ajo ennen ensimmäistä ottelua
  // (games_played = 0), ei historian vanhin rivi -- sama kuin rank_context.
  const pre = history.filter((h) => h.games === 0);
  const preDate = pre.length ? pre[pre.length - 1].date : null;
  const preseason = new Map(pre.filter((h) => h.date === preDate).map((h) => [h.team, h.points]));
  const fixtures: Fixture[] = fx.map((r) => ({
    start_ts: String(r.START_TS), home: String(r.HOME_TEAM), away: String(r.AWAY_TEAM), ended: Boolean(r.ENDED),
    hg: num(r.HOME_GOALS), ag: num(r.AWAY_GOALS), category: r.RESULT_CATEGORY == null ? null : String(r.RESULT_CATEGORY),
    pHome: num(r.P_HOME_WIN), pOt: num(r.P_OVERTIME),
  }));
  return {
    games, teams: teams.map((t) => t.TEAM).sort((a, b) => a.localeCompare(b, "fi")), meta: meta[0], position,
    next: next[0], title, history, preseason, fixtures,
  };
}

const TABS = [["", "Sarjataulukko"], ["koti", "Koti / vieras"], ["maalit", "Maalinteko"], ["erikois", "Erikoistilanteet"]] as const;

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const d = await load();
  const window = [5, 10, 20].includes(Number(sp.ikkuna)) ? Number(sp.ikkuna) : 10;
  const highlight = new Set((sp.joukkue ?? "").split(",").map((s) => s.trim()).filter((s) => d.teams.includes(s)));
  const view = TABS.some(([k]) => k === sp.nakyma) ? sp.nakyma! : "";
  const href = (key: string, value: string | null) => {
    const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => e[1] != null));
    if (value) q.set(key, value); else q.delete(key);
    return q.size ? `/?${q}` : "/";
  };
  const months = [...new Set(d.fixtures.map((f) => f.start_ts.slice(0, 7)))].sort();
  const month = sp.kk && months.includes(sp.kk) ? sp.kk : defaultMonth(d.fixtures, new Date().toISOString());
  const top6 = [...d.title].sort((a, b) => b.pTitle - a.pTitle).slice(0, 6).map((r) => r.team);

  return (
    <div className="shell">
      <Top updatedAt={d.meta?.UPDATED_AT} active="ennuste" />
      <div className="layout">
        <aside className="rail">
          <Suspense><Controls teams={d.teams} /></Suspense>
          <div className="rail-foot">Lähde: Liiga.fi · Snowflake LIIGA.MODEL<br />Malli: pelaajat 40 % · Elo 60 %</div>
        </aside>

        <main className="main">
          {d.meta && <Season played={d.meta.GAMES_PLAYED} total={d.meta.GAMES_TOTAL} nextDate={d.next?.D ?? null} nextGames={Number(d.next?.N ?? 0)} />}

          <Reveal className="block"><Heatmap rows={d.position} highlight={highlight} /></Reveal>

          <Reveal className="block">
            <Kpis log={d.games} teams={d.teams} window={window} />
            <nav className="tabs" aria-label="Näkymä">
              {TABS.map(([k, label]) => (
                <Link key={k} href={href("nakyma", k || null)} scroll={false} className={view === k ? "on" : ""} aria-current={view === k ? "page" : undefined}>{label}</Link>
              ))}
            </nav>
            {view === "" && <FormTable log={d.games} teams={d.teams} window={window} highlight={highlight} showSpark={sp.kayra !== "0"} showXg={sp.xg === "1"} />}
            {view === "koti" && <SplitTable log={d.games} teams={d.teams} highlight={highlight} />}
            {view === "maalit" && <GoalsTable log={d.games} teams={d.teams} highlight={highlight} />}
            {view === "erikois" && <SpecialTable log={d.games} teams={d.teams} highlight={highlight} />}
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
          </Reveal>

          <Reveal className="block">
            <div className="label">Runkosarjan voittaja</div>
            <TitleRace rows={d.title} highlight={highlight} />
            <div className="legend"><span><i className="sw-got" />Kerätty</span><span><i className="sw-sim" />Simuloitu loppukausi</span></div>
            <TitleHistory history={d.history} top={top6} highlight={highlight} />
          </Reveal>

          <Reveal className="block">
            <div className="label-row">
              <div className="label">Ottelut</div>
              <Months months={months} chosen={month} href={(m) => href("kk", m)} />
            </div>
            <Score fixtures={d.fixtures} />
            <FixtureList fixtures={d.fixtures.filter((f) => f.start_ts.startsWith(month))} highlight={highlight} />
            <div className="label sub">Missä malli menee pieleen</div>
            <Misses fixtures={d.fixtures} highlight={highlight} />
          </Reveal>

          <Reveal className="block">
            <div className="label">Ennusteen liike</div>
            <History history={d.history} order={[...d.position].sort((a, b) => a.projRank - b.projRank).map((r) => r.team)}
              highlight={highlight} preseason={d.preseason} />
          </Reveal>
        </main>
      </div>
    </div>
  );
}
