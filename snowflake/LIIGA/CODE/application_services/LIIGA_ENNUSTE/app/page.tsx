// Liiga Ennuste, osio "Kuka on kuumana?".
// Valinnat ovat URL-parametreja, jotta agentti voi linkittää suoraan näkymään:
//   /?joukkue=KooKoo,Jokerit&ikkuna=10&kayra=0&xg=1
import { Suspense } from "react";
import Controls from "@/components/Controls";
import FormTable from "@/components/FormTable";
import Kpis from "@/components/Kpis";
import { query } from "@/lib/snowflake";
import { type Game, PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT } from "@/lib/table";

export const dynamic = "force-dynamic";   // tuore data joka latauksella

type Params = { joukkue?: string; ikkuna?: string; kayra?: string; xg?: string };

async function load() {
  const [log, teams, meta] = await Promise.all([
    query<Record<string, unknown>>(`
      SELECT team, start_ts, points, goals_for, goals_against, xg_for, xg_against
      FROM LIIGA.MODEL.TEAM_GAME_LOG
      WHERE season = (SELECT MAX(season) FROM LIIGA.MODEL.TEAM_GAME_LOG)
      ORDER BY team, start_ts`),
    query<{ TEAM: string }>(`
      SELECT DISTINCT home_team AS team FROM LIIGA.MODEL.STG_GAMES
      WHERE season = (SELECT MAX(season) FROM LIIGA.MODEL.STG_GAMES) ORDER BY 1`),
    query<{ UPDATED_AT: string; GAMES_PLAYED: number; GAMES_TOTAL: number }>(
      `SELECT updated_at, games_played, games_total FROM LIIGA.MODEL.PREDICTION_META`),
  ]);
  const games: Game[] = log.map((r) => ({
    team: String(r.TEAM), start_ts: String(r.START_TS), points: Number(r.POINTS),
    goals_for: Number(r.GOALS_FOR), goals_against: Number(r.GOALS_AGAINST),
    xg_for: r.XG_FOR == null ? null : Number(r.XG_FOR), xg_against: r.XG_AGAINST == null ? null : Number(r.XG_AGAINST),
  }));
  return { games, teams: teams.map((t) => t.TEAM).sort((a, b) => a.localeCompare(b, "fi")), meta: meta[0] };
}

function stamp(iso: string) {
  const f = new Intl.DateTimeFormat("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}. klo ${p.hour}.${p.minute}`;
}

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { games, teams, meta } = await load();
  const window = [5, 10, 20].includes(Number(sp.ikkuna)) ? Number(sp.ikkuna) : 10;
  const highlight = new Set((sp.joukkue ?? "").split(",").map((s) => s.trim()).filter((s) => teams.includes(s)));
  const showSpark = sp.kayra !== "0";
  const showXg = sp.xg === "1";
  const progress = meta ? (100 * meta.GAMES_PLAYED) / meta.GAMES_TOTAL : 0;

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden>◆</span>
          <div>
            <div className="brand-name">Liiga Ennuste</div>
            <div className="brand-sub">Runkosarja 2026–27</div>
          </div>
        </div>
        <div className="season" title={`${meta?.GAMES_PLAYED} / ${meta?.GAMES_TOTAL} ottelua pelattu`}>
          <div className="season-row"><span>Kausi</span><b>{meta?.GAMES_PLAYED} / {meta?.GAMES_TOTAL}</b></div>
          <div className="season-bar"><i style={{ width: `${progress.toFixed(1)}%` }} /></div>
        </div>
        <div className="fresh"><span className="dot" />Päivitetty {meta ? stamp(meta.UPDATED_AT) : "–"}</div>
      </header>

      <div className="layout">
        <aside className="rail">
          <Suspense><Controls teams={teams} /></Suspense>
          <div className="rail-foot">Lähde: Liiga.fi · Snowflake LIIGA.MODEL<br />Malli: pelaajat 40 % · Elo 60 %</div>
        </aside>

        <main className="main">
          <div className="eyebrow">Toteutuneet tulokset</div>
          <h1>Kuka on kuumana?</h1>
          <p className="lede">Sarjataulukko ja viimeisten otteluiden vire samassa näkymässä. Ennuste loppukaudesta on omassa osiossaan.</p>

          <Kpis log={games} teams={teams} window={window} />

          <nav className="tabs" aria-label="Näkymä">
            <a className="on" aria-current="page">Sarjataulukko</a>
            <a className="soon" title="Tulossa">Koti / vieras</a>
            <a className="soon" title="Tulossa">Maalinteko</a>
            <a className="soon" title="Tulossa">Erikoistilanteet</a>
          </nav>

          <FormTable log={games} teams={teams} window={window} highlight={highlight} showSpark={showSpark} showXg={showXg} />

          <div className="legend">
            <span><i className="res res-w">V</i>Voitto</span>
            <span><i className="res res-otw">J</i>Voitto jatkoajalla</span>
            <span><i className="res res-otl">H</i>Häviö jatkoajalla</span>
            <span><i className="res res-l">H</i>Häviö</span>
            <span className="sep-l"><i className="zl z-top" />1.–{PLAYOFF_CUT}. puolivälierät</span>
            <span><i className="zl z-quali" />{PLAYOFF_CUT + 1}.–{QUALI_CUT}. karsinta</span>
            <span><i className="zl z-down" />{RELEGATION_CUT + 1}.–17. putoaa</span>
          </div>
        </main>
      </div>
    </div>
  );
}
