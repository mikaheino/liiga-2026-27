// Datan haku sivuille.
//
// Välimuisti ennusteen aikaleiman mukaan (16.10.: "jos painan linkkiä, mitään ei
// tapahdu"): yksittäinen kysely kesti 0,3-11 s ja sivu odotti hitainta, vaikka
// data vaihtuu kerran päivässä. Nyt pyyntö tekee vain yhden kevyen
// PREDICTION_META-tarkistuksen (enintään kerran 30 sekunnissa) ja kaikki muu
// tulee muistista. Uusi aikaleima tyhjentää muistin -- sama periaate kuin
// Streamlitin @st.cache_data-avaimessa. Ensimmäinen haku käynnistää taustalla
// kaikkien sivujen datan, joten seuraava linkki aukeaa heti.
import type { PositionRow } from "@/components/Heatmap";
import type { HistoryPoint, TitleRow } from "@/components/TitleRace";
import type { Fixture } from "@/lib/fixtures";
import { DATA_MODE, query } from "@/lib/snowflake";
import type { Game } from "@/lib/table";

const M = "LIIGA.MODEL";
const CHECK_MS = 30_000;

type Store = { stamp: string; checked: number; meta: Promise<unknown> | null; values: Map<string, Promise<unknown>> };
const store: Store = ((globalThis as { __liigaData?: Store }).__liigaData ??= { stamp: "", checked: 0, meta: null, values: new Map() });
const warmers: (() => Promise<unknown>)[] = [];

function metaQuery() {
  return Promise.all([
    query<{ UPDATED_AT: string; GAMES_PLAYED: number; GAMES_TOTAL: number }>(
      `SELECT updated_at, games_played, games_total FROM ${M}.PREDICTION_META`),
    // Seuraava pelipäivä: Snowflakessa näkymästä, DuckDB:ssä (ei näkymää) otteluohjelmasta.
    query<{ D: string; N: number }>(DATA_MODE === "snowflake" ? `
      SELECT TO_CHAR(MIN(game_date), 'YYYY-MM-DD') AS d,
             COUNT_IF(game_date = (SELECT MIN(game_date) FROM ${M}.V_UPCOMING_PREDICTIONS)) AS n
      FROM ${M}.V_UPCOMING_PREDICTIONS` : `
      WITH up AS (SELECT SUBSTR(start_ts, 1, 10) AS d FROM stg_games
                  WHERE season = (SELECT MAX(season) FROM stg_games) AND NOT ended AND SUBSTR(start_ts, 1, 10) >= strftime(current_date, '%Y-%m-%d'))
      SELECT MIN(d) AS d, COUNT(*) FILTER (WHERE d = (SELECT MIN(d) FROM up)) AS n FROM up`),
  ]).then(([meta, next]) => ({ meta: meta[0], next: next[0] }));
}

async function fresh() {
  if (!store.meta || Date.now() - store.checked > CHECK_MS) {
    store.checked = Date.now();
    store.meta = metaQuery().catch((e) => { store.meta = null; throw e; });
  }
  const m = (await store.meta) as Awaited<ReturnType<typeof metaQuery>>;
  const stamp = String(m.meta?.UPDATED_AT ?? "");
  if (stamp !== store.stamp) {
    store.stamp = stamp;
    store.values.clear();
    for (const w of warmers) w().catch(() => {});     // esilämmitys taustalla
  }
  return m;
}

function memo<T>(key: string, fn: () => Promise<T>): () => Promise<T> {
  const get = async () => {
    await fresh();
    let p = store.values.get(key) as Promise<T> | undefined;
    if (!p) {
      p = fn().catch((e) => { store.values.delete(key); throw e; });
      store.values.set(key, p);
    }
    return p;
  };
  warmers.push(get);
  return get;
}
const num = (v: unknown) => (v == null ? null : Number(v));

export const loadMeta = fresh;

export const loadTeams = memo("loadTeams", async () => {
  const t = await query<{ TEAM: string }>(`
    SELECT DISTINCT home_team AS team FROM ${M}.STG_GAMES
    WHERE season = (SELECT MAX(season) FROM ${M}.STG_GAMES)`);
  return t.map((r) => r.TEAM).sort((a, b) => a.localeCompare(b, "fi"));
});

export const loadPosition = memo("loadPosition", async () => {
  const pos = await query(`
    SELECT s.team, s.proj_rank, s.mean_points, s.p05_points, s.p95_points, s.p_title, p.*
    FROM ${M}.STANDINGS_2026_27 s
    JOIN ${M}.POSITION_DISTRIBUTION_2026_27 p ON p.team = s.team
    ORDER BY s.proj_rank`);
  const rows: (PositionRow & { pTitle: number })[] = pos.map((r) => ({
    team: String(r.TEAM), projRank: Number(r.PROJ_RANK), points: Number(r.MEAN_POINTS),
    p05: Number(r.P05_POINTS), p95: Number(r.P95_POINTS), pTitle: 100 * Number(r.P_TITLE),
    p: Array.from({ length: 17 }, (_, i) => Number(r[`RANK_${i + 1}`] ?? 0)),
  }));
  return rows;
});

// 14 parhaan pisteraja simulaatiosta (simulate.points_line). SELECT *, koska
// Snowflaken PREDICTION_META saa sarakkeet vasta kun notebook ajaa uuden koodin:
// puuttuvat sarakkeet -> null, ja sovellus näyttää kiinteän 80 p:n oletuksen.
export const loadLine = memo("loadLine", async () => {
  const [r] = await query(`SELECT * FROM ${M}.PREDICTION_META`);
  const rank = num(r?.LINE_RANK), likely = num(r?.LINE_LIKELY), safe = num(r?.LINE_SAFE);
  return rank && likely && safe ? { rank, likely, safe } : null;
});

export const loadLog = memo("loadLog", async (): Promise<Game[]> => {
  const log = await query(`
    SELECT team, start_ts, points, goals_for, goals_against, xg_for, xg_against,
           is_home, pp_goals, pp_instances, sh_instances, pp_goals_against
    FROM ${M}.TEAM_GAME_LOG
    WHERE season = (SELECT MAX(season) FROM ${M}.TEAM_GAME_LOG)
    ORDER BY team, start_ts`);
  return log.map((r) => ({
    team: String(r.TEAM), start_ts: String(r.START_TS), points: Number(r.POINTS),
    goals_for: Number(r.GOALS_FOR), goals_against: Number(r.GOALS_AGAINST), xg_for: num(r.XG_FOR), xg_against: num(r.XG_AGAINST),
    is_home: Boolean(r.IS_HOME), pp_goals: Number(r.PP_GOALS ?? 0), pp_instances: Number(r.PP_INSTANCES ?? 0),
    sh_instances: Number(r.SH_INSTANCES ?? 0), pp_goals_against: Number(r.PP_GOALS_AGAINST ?? 0),
  }));
});

export async function loadTitle(): Promise<TitleRow[]> {
  const [pos, log] = await Promise.all([loadPosition(), loadLog()]);
  const banked = new Map<string, number>();
  for (const g of log) banked.set(g.team, (banked.get(g.team) ?? 0) + g.points);
  return pos.map((r) => ({ team: r.team, pTitle: r.pTitle, points: r.points, banked: banked.get(r.team) ?? 0 }));
}

export const loadHistory = memo("loadHistory", async () => {
  const hist = await query(`SELECT team, snapshot_date, mean_points, p_title, games_played FROM ${M}.PREDICTION_HISTORY ORDER BY snapshot_date`);
  const history: HistoryPoint[] = hist.map((r) => ({
    team: String(r.TEAM), date: String(r.SNAPSHOT_DATE).slice(0, 10), points: Number(r.MEAN_POINTS),
    pTitle: 100 * Number(r.P_TITLE), games: Number(r.GAMES_PLAYED),
  }));
  // Esikauden vertailukohta = viimeisin ajo ennen ensimmäistä ottelua
  // (games_played = 0), ei historian vanhin rivi -- sama kuin rank_context.
  const pre = history.filter((h) => h.games === 0);
  const preDate = pre.length ? pre[pre.length - 1].date : null;
  const preseason = new Map(pre.filter((h) => h.date === preDate).map((h) => [h.team, h.points]));
  return { history, preseason };
});

// Sama liitos kuin streamlit_app.py:n fixtures_sql: uusin snapshot
// ottelupäivänä tai ennen -- se mitä malli sanoi ennen kiekon pudotusta.
export const loadFixtures = memo("loadFixtures", async (): Promise<Fixture[]> => {
  const fx = await query(`
    SELECT g.start_ts, g.home_team, g.away_team, g.ended, g.home_goals, g.away_goals,
           g.result_category, p.p_home_win, p.p_overtime
    FROM ${M}.STG_GAMES g
    LEFT JOIN ${M}.PREDICTION_GAMES p ON p.game_id = g.game_id
         AND p.snapshot_date = (SELECT MAX(p2.snapshot_date) FROM ${M}.PREDICTION_GAMES p2
                                WHERE p2.game_id = g.game_id AND p2.snapshot_date <= SUBSTR(g.start_ts, 1, 10))
    WHERE g.season = (SELECT MAX(season) FROM ${M}.STG_GAMES)
    ORDER BY g.start_ts, g.home_team`);
  return fx.map((r) => ({
    start_ts: String(r.START_TS), home: String(r.HOME_TEAM), away: String(r.AWAY_TEAM), ended: Boolean(r.ENDED),
    hg: num(r.HOME_GOALS), ag: num(r.AWAY_GOALS), category: r.RESULT_CATEGORY == null ? null : String(r.RESULT_CATEGORY),
    pHome: num(r.P_HOME_WIN), pOt: num(r.P_OVERTIME),
  }));
});

export { type Params, highlightOf, hrefWith } from "@/lib/params";

export const teamHref = (team: string) => `/joukkue/${encodeURIComponent(team)}`;
