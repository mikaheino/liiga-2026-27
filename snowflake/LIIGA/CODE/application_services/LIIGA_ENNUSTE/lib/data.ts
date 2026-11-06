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
import fs from "node:fs";
import path from "node:path";
import { runEngine } from "@/lib/scenarioEngine";
import { type LockState, type QPoint, type QuestionView, NEWS_COL, QUESTIONS, goalP, lockState, trend } from "@/lib/seasonQuestions";
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

const NEWS_DB = path.join(process.env.LIIGA_REPO ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../../../.."), "data", "news.duckdb");
function newsStamp(): string {
  if (DATA_MODE === "snowflake") return "";
  try { return String(fs.statSync(NEWS_DB).mtimeMs); } catch { return ""; }
}

async function fresh() {
  if (!store.meta || Date.now() - store.checked > CHECK_MS) {
    store.checked = Date.now();
    store.meta = metaQuery().catch((e) => { store.meta = null; throw e; });
  }
  const m = (await store.meta) as Awaited<ReturnType<typeof metaQuery>>;
  // Paikallisesti myös uutiskannan muutos (scripts/news/news_pull.py) tyhjentää
  // välimuistin: uutiset päivittyvät useammin kuin ennuste.
  const stamp = `${m.meta?.UPDATED_AT ?? ""}|${newsStamp()}`;
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
// Avaimessa rivin muodon versio: muisti säilyy kehityspalvelimen kuumassa
// latauksessa, ja vanhan muotoiset rivit (ilman season/gameId) jäivät käyttöön 5.11.
export const loadFixtures = memo("loadFixtures:v2", async (): Promise<Fixture[]> => {
  const fx = await query(`
    SELECT g.season, g.game_id, g.start_ts, g.home_team, g.away_team, g.ended, g.home_goals, g.away_goals,
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
    season: num(r.SEASON) ?? undefined, gameId: num(r.GAME_ID) ?? undefined,
  }));
});

// Pelaajat (5.11.2026, /pelaajat ja pelaajakortin agentti): kenttäpelaajat ja
// maalivahdit kuluvalla kaudella. Snowflakessa valmiit näkymät V_PLAYER_SEASON_NOW ja
// V_GOALIE_SEASON_NOW (sama logiikka kuin agentin semanttisessa mallissa); DuckDB:ssä
// (paikallinen + Pages) niitä ei ole, joten samat kyselyt pohjatauluista -- todennettu
// 5.11.: 484 + 41 riviä ja sama kärki desimaaleja myöten molemmissa.
export type Skater = { id: number; name: string; team: string; position: string; gp: number; goals: number; assists: number;
  points: number; ppGoals: number; prePpg: number | null; vsPre: number | null };
export type Goalie = { id: number; name: string; team: string; gp: number; starts: number; solo: number | null; ga: number | null;
  gaa: number | null; savedAvg: number | null; preSv: number | null; savedPre: number | null };
const SKATERS_DUCK = `
    WITH cur AS (SELECT MAX(season) AS s FROM stg_games),
    gp AS (
      SELECT l.player_id, MAX(l.first_name) AS first_name, MAX(l.last_name) AS last_name,
             MAX(l.team) AS team, MAX(l.position_group) AS position_group,
             COUNT(DISTINCT l.game_id) AS games_played
      FROM game_lineups l
      JOIN stg_games g ON g.game_id = l.game_id AND g.season = l.season AND g.ended
      WHERE l.season = (SELECT s FROM cur) AND l.position_group <> 'G' AND NOT COALESCE(l.removed, FALSE)
      GROUP BY l.player_id),
    goals AS (
      SELECT e.player_id, COUNT(*) AS goals,
             COUNT(*) FILTER (WHERE e.is_powerplay) AS pp_goals
      FROM raw_goal_events e
      WHERE e.season = (SELECT s FROM cur) AND e.player_id <> 0 AND NOT COALESCE(e.is_shootout, FALSE)
        AND COALESCE(e.goal_types, '') NOT LIKE '%RL0%' AND COALESCE(e.goal_types, '') NOT LIKE '%VT0%'
      GROUP BY e.player_id),
    pss AS (SELECT player_id, assists FROM player_season_scoring WHERE season = (SELECT s FROM cur)),
    pre_id AS (SELECT player_id, MAX(ppg) AS ppg FROM preseason_player_rates WHERE player_id IS NOT NULL GROUP BY player_id),
    pre_nm AS (SELECT LOWER(name) AS nm, team, MAX(ppg) AS ppg FROM preseason_player_rates GROUP BY 1, 2)
    SELECT gp.player_id, gp.first_name || ' ' || gp.last_name AS player_name, gp.team,
           CASE WHEN gp.position_group = 'D' THEN 'Puolustaja' ELSE 'Hyökkääjä' END AS position,
           gp.games_played, COALESCE(gl.goals, 0) AS goals, COALESCE(s.assists, 0) AS assists,
           COALESCE(gl.goals, 0) + COALESCE(s.assists, 0) AS points, COALESCE(gl.pp_goals, 0) AS pp_goals,
           COALESCE(pi.ppg, pn.ppg) AS preseason_points_per_game,
           COALESCE(gl.goals, 0) + COALESCE(s.assists, 0) - COALESCE(pi.ppg, pn.ppg) * gp.games_played AS points_vs_preseason
    FROM gp
    LEFT JOIN goals gl ON gl.player_id = gp.player_id
    LEFT JOIN pss s ON s.player_id = gp.player_id
    LEFT JOIN pre_id pi ON pi.player_id = gp.player_id
    LEFT JOIN pre_nm pn ON pn.nm = LOWER(gp.first_name || ' ' || gp.last_name) AND pn.team = gp.team
    ORDER BY points DESC, goals DESC, games_played ASC`;
const GOALIES_DUCK = `
    WITH cur AS (SELECT MAX(season) AS s FROM stg_games),
    gg AS (SELECT * FROM game_goalies WHERE season = (SELECT s FROM cur) AND played),
    solo AS (SELECT game_id, team FROM gg GROUP BY game_id, team HAVING COUNT(*) = 1),
    s AS (
      SELECT g.player_id, g.team, g.goals_against, l.xg_against
      FROM gg g
      JOIN solo o ON o.game_id = g.game_id AND o.team = g.team
      JOIN team_game_log l ON l.season = g.season AND l.game_id = g.game_id AND l.team = g.team),
    scale AS (SELECT SUM(goals_against) / NULLIF(SUM(xg_against), 0) AS r FROM s),
    tot AS (
      SELECT player_id, MAX(first_name) AS first_name, MAX(last_name) AS last_name, MAX(team) AS team,
             COUNT(*) AS games_played, COUNT(*) FILTER (WHERE started) AS starts
      FROM gg GROUP BY player_id),
    agg AS (SELECT player_id, COUNT(*) AS solo_games, SUM(goals_against) AS goals_against, SUM(xg_against) AS xg_against FROM s GROUP BY player_id),
    pre AS (SELECT LOWER(name) AS nm, team, MAX(proj_save_pct) AS proj_save_pct FROM preseason_player_rates WHERE position_group = 'G' GROUP BY 1, 2)
    SELECT t.player_id, t.first_name || ' ' || t.last_name AS goalie_name, t.team, t.games_played, t.starts,
           a.solo_games, a.goals_against, a.goals_against / NULLIF(a.solo_games, 0) AS goals_against_per_game,
           a.xg_against * (SELECT r FROM scale) - a.goals_against AS goals_saved_vs_average,
           p.proj_save_pct AS preseason_save_pct,
           a.xg_against * (SELECT r FROM scale) * (1 - p.proj_save_pct) / (1 - 0.908) - a.goals_against AS goals_saved_vs_preseason
    FROM tot t
    LEFT JOIN agg a ON a.player_id = t.player_id
    LEFT JOIN pre p ON p.nm = LOWER(t.first_name || ' ' || t.last_name) AND p.team = t.team
    ORDER BY goals_saved_vs_average DESC NULLS LAST`;
export const loadPlayers = memo("loadPlayers:v2", async () => {   // v2: ei voittolaukausmaaleja
  const [sk, gk] = await Promise.all([
    query(DATA_MODE === "snowflake"
      ? `SELECT player_id, player_name, team, position, games_played, goals, assists, points, pp_goals,
                preseason_points_per_game, points_vs_preseason
         FROM ${M}.V_PLAYER_SEASON_NOW ORDER BY points DESC, goals DESC, games_played ASC`
      : SKATERS_DUCK),
    query(DATA_MODE === "snowflake"
      ? `SELECT player_id, goalie_name, team, games_played, starts, solo_games, goals_against, goals_against_per_game,
                goals_saved_vs_average, preseason_save_pct, goals_saved_vs_preseason
         FROM ${M}.V_GOALIE_SEASON_NOW ORDER BY goals_saved_vs_average DESC NULLS LAST`
      : GOALIES_DUCK),
  ]);
  const seen = new Set<number>();         // esikauden nimiliitos voi monistaa rivin
  const skaters: Skater[] = sk.map((r) => ({
    id: Number(r.PLAYER_ID), name: String(r.PLAYER_NAME), team: String(r.TEAM), position: String(r.POSITION), gp: Number(r.GAMES_PLAYED),
    goals: Number(r.GOALS), assists: Number(r.ASSISTS), points: Number(r.POINTS), ppGoals: Number(r.PP_GOALS ?? 0),
    prePpg: num(r.PRESEASON_POINTS_PER_GAME), vsPre: num(r.POINTS_VS_PRESEASON),
  })).filter((r) => !seen.has(r.id) && (seen.add(r.id), true));
  const goalies: Goalie[] = gk.map((r) => ({
    id: Number(r.PLAYER_ID), name: String(r.GOALIE_NAME), team: String(r.TEAM), gp: Number(r.GAMES_PLAYED), starts: Number(r.STARTS),
    solo: num(r.SOLO_GAMES), ga: num(r.GOALS_AGAINST), gaa: num(r.GOALS_AGAINST_PER_GAME), savedAvg: num(r.GOALS_SAVED_VS_AVERAGE),
    preSv: num(r.PRESEASON_SAVE_PCT), savedPre: num(r.GOALS_SAVED_VS_PRESEASON),
  }));
  return { skaters, goalies };
});

// Pelaajan aiemmat Liiga-kaudet (6.11.2026, pelaajakortti ja agentin tilannekuva).
// Snowflakessa V_PLAYER_SEASONS, DuckDB:ssä sama kysely pohjatauluista. Maalit
// virallisella säännöllä: ei voittolaukausmaaleja (is_shootout), ei RL0:aa eikä VT0:aa
// -- PLAYER_SEASON_SCORINGin oma goals laskee RL0:t (docs/claude/data.md). Aiemmilta
// kausilta ei ole kokoonpanoja, joten tahti on per joukkueen ottelu, kuten mallissa.
export type PastSeason = { season: number; team: string; goals: number; assists: number; teamGames: number };
const HISTORY_DUCK = `
    WITH cur AS (SELECT MAX(season) AS s FROM stg_games),
    goals AS (
      SELECT season, player_id, team, COUNT(*) AS goals
      FROM raw_goal_events
      WHERE player_id <> 0 AND NOT COALESCE(is_shootout, FALSE)
        AND COALESCE(goal_types, '') NOT LIKE '%RL0%' AND COALESCE(goal_types, '') NOT LIKE '%VT0%'
      GROUP BY 1, 2, 3),
    model AS (SELECT player_id, MAX(n_seasons) AS n_seasons FROM player_rates_unified WHERE player_id IS NOT NULL GROUP BY 1)
    SELECT s.player_id, s.season, s.team, COALESCE(g.goals, 0) AS goals, COALESCE(s.assists, 0) AS assists,
           s.team_games, m.n_seasons AS model_seasons_used
    FROM player_season_scoring s
    LEFT JOIN goals g ON g.season = s.season AND g.player_id = s.player_id AND g.team = s.team
    LEFT JOIN model m ON m.player_id = s.player_id
    WHERE s.season < (SELECT s FROM cur)
    ORDER BY s.player_id, s.season, s.team`;
// Virhe hylätään (ei tyhjää välimuistiin, ks. loadPositionHistory); kutsujat
// näyttävät kortin ilman historiaa, jos näkymää ei vielä ole.
export const loadPlayerHistory = memo("loadPlayerHistory:v2", async () => {
  const rows = await query(DATA_MODE === "snowflake"
    ? `SELECT player_id, season, team, goals, assists, team_games, model_seasons_used
       FROM ${M}.V_PLAYER_SEASONS WHERE NOT is_current_season ORDER BY player_id, season, team`
    : HISTORY_DUCK);
  const seasons: Record<number, PastSeason[]> = {}, used: Record<number, number> = {};
  for (const r of rows) {
    const id = Number(r.PLAYER_ID);
    (seasons[id] ??= []).push({ season: Number(r.SEASON), team: String(r.TEAM), goals: Number(r.GOALS), assists: Number(r.ASSISTS),
      teamGames: Number(r.TEAM_GAMES) });
    if (r.MODEL_SEASONS_USED != null) used[id] = Number(r.MODEL_SEASONS_USED);
  }
  return { seasons, used };
});

// Sijaintijakauman historia (6.11.2026): etusivun heatmapia voi kelata kauden
// taaksepäin yläpalkista. pipeline.persist() tallentaa jakauman päivittäin, menneet
// päivät täydennettiin git-versioista (scripts/tools/backfill_position_history.py).
// Ilman taulua kelaus vain puuttuu -- mutta virhe HYLÄTÄÄN eikä muuteta tyhjäksi:
// memo() tallentaisi tyhjän onnistumisena seuraavaan ennusteajoon asti, ja yksi
// ohimenevä DuckDB-lukitus piilotti kelauksen (6.11.). Kutsuja käsittelee virheen.
// Sija = sen päivän PREDICTION_HISTORY.proj_rank (sama lähde kuin nykyinen järjestys),
// jotta kelattaessa joukkueet asettuvat sen hetken järjestykseen (käyttäjä 6.11.:
// "joukkueet eivät liiku ylös alas ... lukija ei osaa tulkita tätä").
// Tarvittavat pisteet kelattaessa (6.11.): sen päivän 14 parhaan raja (LINE_HISTORY) ja
// joukkueiden silloiset pisteet ja ottelut = ensimmäiset N pelattua ottelua aloitusajan
// mukaan (sama joukko, joka todennettiin virallista sarjataulukkoa vasten).
export type SnapLine = { rank: number; likely: number; safe: number };
export type Snap = { date: string; played: number; p: Record<string, number[]>; rank: Record<string, number>;
  line: SnapLine | null; table: Record<string, { pts: number; gp: number }> };
const missingTable = (e: unknown) => /does not exist/i.test(String((e as Error)?.message ?? e));
function pointsOf(f: Fixture): [number, number] {
  const extra = f.category === "overtime" || f.category === "shootout";
  return f.hg! > f.ag! ? (extra ? [2, 1] : [3, 0]) : (extra ? [1, 2] : [0, 3]);
}
export const loadPositionHistory = memo("loadPositionHistory:v5", async (): Promise<Snap[]> => {
  const [lineRows, fx] = await Promise.all([
    query(`SELECT * FROM ${M}.LINE_HISTORY`).catch((e) => { if (missingTable(e)) return [] as Record<string, unknown>[]; throw e; }),
    loadFixtures(),
  ]);
  const lines = new Map(lineRows.map((r) => [String(r.SNAPSHOT_DATE).slice(0, 10),
    { rank: Number(r.LINE_RANK), likely: Number(r.LINE_LIKELY), safe: Number(r.LINE_SAFE) }]));
  const played = fx.filter((f) => f.ended && f.hg != null && f.ag != null)
    .sort((a, b) => a.start_ts.localeCompare(b.start_ts) || (a.gameId ?? 0) - (b.gameId ?? 0));
  const rows = await query(`
    SELECT h.*, p.proj_rank AS hist_rank FROM ${M}.POSITION_DISTRIBUTION_HISTORY h
    LEFT JOIN ${M}.PREDICTION_HISTORY p
      ON CAST(p.snapshot_date AS VARCHAR) = CAST(h.snapshot_date AS VARCHAR) AND p.team = h.team
    ORDER BY h.snapshot_date, h.team`);
  const by = new Map<string, Snap>();
  for (const r of rows) {
    const d = String(r.SNAPSHOT_DATE).slice(0, 10);
    const snap = by.get(d) ?? { date: d, played: Number(r.GAMES_PLAYED), p: {}, rank: {}, line: lines.get(d) ?? null, table: {} };
    snap.p[String(r.TEAM)] = Array.from({ length: 17 }, (_, i) => Math.round(Number(r[`RANK_${i + 1}`] ?? 0) * 1e4) / 1e4);
    if (r.HIST_RANK != null) snap.rank[String(r.TEAM)] = Number(r.HIST_RANK);
    by.set(d, snap);
  }
  for (const snap of by.values()) {
    for (const f of played.slice(0, snap.played)) {
      const [hp, ap] = pointsOf(f);
      for (const [t, p] of [[f.home, hp], [f.away, ap]] as const) {
        const row = (snap.table[t] ??= { pts: 0, gp: 0 });
        row.pts += p; row.gp += 1;
      }
    }
  }
  return [...by.values()];
});

// Uutishaastaja (27.10.): taulut syntyvät vain Pages-käännöksessä
// (scripts/news/load_news.py news-data-haarasta). Snowflakessa ja ilman tauluja
// tyhjä lista, jotta sivut toimivat silti.
const optional = <T>(f: () => Promise<T[]>): Promise<T[]> =>
  DATA_MODE === "duckdb" ? f().catch(() => [] as T[]) : Promise.resolve([]);
export type NewsItem = { published: string; fetched: string; source: string; team: string; flags: string; title: string; url: string; summary: string };
export type HistoryEvent = { approvedAt: string; url: string; player: string; team: string; kind: string; games: string; start: string; until: string; source: string;
  status: string; nGames: number | null; winBefore: number | null; winAfter: number | null; xp: number | null };
export type Candidate = { url: string; player: string; team: string; position: string };
export type Player = { player: string; team: string; position: string };
export type NewsEffect = { url: string; player: string; team: string; games: number; winBefore: number; winAfter: number; xp: number; approved: boolean };
export type Absence = { url: string; player: string; team: string; kind: string; games: string; start: string; until: string; source: string };
export type Challenger = { date: string; home: string; away: string; base: number; pHome: number; pOt: number; notes: string };

export const loadNews = memo("loadNews", async () => {
  const [items, cands, abs, roster, eff, ev] = await Promise.all([
    optional(() => query(`SELECT published, fetched_at, source, team, flags, title, url, summary FROM news_items
                          ORDER BY COALESCE(NULLIF(published, ''), fetched_at) DESC LIMIT 300`)),
    optional(() => query(`SELECT url, player, team, position FROM news_candidates`)),
    optional(() => query(`SELECT url, player, team, kind, games, start, until, source FROM news_absences ORDER BY approved_at`)),
    optional(() => query(`SELECT player, team, position FROM news_roster ORDER BY team, player`)),
    optional(() => query(`SELECT * FROM news_effects`)),
    optional(() => query(`SELECT * FROM challenger_events`)),
  ]);
  const n = (v: unknown) => (v == null ? null : Number(v));
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    items: items.map((r): NewsItem => ({ published: s(r.PUBLISHED), fetched: s(r.FETCHED_AT), source: s(r.SOURCE), team: s(r.TEAM),
      flags: s(r.FLAGS), title: s(r.TITLE), url: s(r.URL), summary: s(r.SUMMARY) })),
    events: ev.map((r): HistoryEvent => ({ approvedAt: s(r.APPROVED_AT), url: s(r.URL), player: s(r.PLAYER), team: s(r.TEAM), kind: s(r.KIND),
      games: s(r.GAMES), start: s(r.START), until: s(r.UNTIL), source: s(r.SOURCE), status: s(r.STATUS), nGames: n(r.N_GAMES), winBefore: n(r.WIN_BEFORE),
      winAfter: n(r.WIN_AFTER), xp: n(r.XP_DELTA) })),
    candidates: cands.map((r): Candidate => ({ url: s(r.URL), player: s(r.PLAYER), team: s(r.TEAM), position: s(r.POSITION) })),
    effects: eff.map((r): NewsEffect => ({ url: s(r.URL), player: s(r.PLAYER), team: s(r.TEAM), games: Number(r.N_GAMES),
      winBefore: Number(r.WIN_BEFORE), winAfter: Number(r.WIN_AFTER), xp: Number(r.XP_DELTA), approved: Boolean(r.APPROVED) })),
    roster: roster.map((r): Player => ({ player: s(r.PLAYER), team: s(r.TEAM), position: s(r.POSITION) })),
    absences: abs.map((r): Absence => ({ url: s(r.URL), player: s(r.PLAYER), team: s(r.TEAM), kind: s(r.KIND), games: s(r.GAMES), start: s(r.START), until: s(r.UNTIL), source: s(r.SOURCE) })),
  };
});

export const loadChallenger = memo("loadChallenger", async (): Promise<Challenger[]> => {
  const rows = await optional(() => query(`SELECT snapshot_date, home_team, away_team, base_p_home_win, p_home_win, p_overtime, notes
                                           FROM prediction_games_news ORDER BY snapshot_date, game_id`));
  return rows.map((r) => ({ date: String(r.SNAPSHOT_DATE), home: String(r.HOME_TEAM), away: String(r.AWAY_TEAM),
    base: Number(r.BASE_P_HOME_WIN), pHome: Number(r.P_HOME_WIN), pOt: Number(r.P_OVERTIME), notes: r.NOTES == null ? "" : String(r.NOTES) }));
});

// Haastajan kausiennuste (scripts/news/challenger_season.py): voimassa olevat
// poissaolot niihin otteluihin, joita ne koskevat, ja kausi simuloituna uudelleen.
export type ChallengerTeam = { team: string; pointsNow: number; points: number; topNow: number; top: number; relNow: number; rel: number; titleNow: number; title: number };
export const loadChallengerSeason = memo("loadChallengerSeason", async () => {
  const [t, g] = await Promise.all([
    optional(() => query(`SELECT * FROM challenger_teams`)),
    optional(() => query(`SELECT * FROM challenger_games`)),
  ]);
  return {
    teams: t.map((r): ChallengerTeam => ({ team: String(r.TEAM), pointsNow: Number(r.POINTS_NOW), points: Number(r.POINTS_SCENARIO),
      topNow: Number(r.P_TOP6_NOW), top: Number(r.P_TOP6_SCENARIO), relNow: Number(r.P_RELEGATION_NOW), rel: Number(r.P_RELEGATION_SCENARIO),
      titleNow: Number(r.P_TITLE_NOW), title: Number(r.P_TITLE_SCENARIO) })),
    games: g.map((r) => ({ date: String(r.DATE), home: String(r.HOME_TEAM), away: String(r.AWAY_TEAM), pHome: Number(r.P_HOME_WIN),
      notes: r.NOTES == null ? "" : String(r.NOTES) })),
  };
});

export { type Params, highlightOf, hrefWith } from "@/lib/params";

export const teamHref = (team: string) => `/joukkue/${encodeURIComponent(team)}`;

// Panokset (6.11.2026, docs/claude/skenaario.md V4): tavoitteen todennäköisyys ehdolla
// ottelun tulos, skenaariomoottorin samoista 10 000 kaudesta (stakes()). Seuraavat
// 14 päivää kattavat myös maaotteluvälin jälkeisen kierroksen. Moottori laskee, tämä
// vain välittää: paikallisesti ja Pagesin käännöksessä skenaario.py, Snowflakessa proseduuri.
export type StakeRow = { team: string; goal: "win" | "top6" | "top10" | "avoid_relegation"; p_now: number;
  p_home_win: number; p_away_win: number; p_home_reg: number; p_ot: number; p_away_reg: number; delta: number; se: number };
export type Stake = { game_id: number; date: string; iso: string; home: string; away: string;
  p_outcome: Record<"home_reg" | "home_ot" | "away_ot" | "away_reg", number>; top: StakeRow; others: StakeRow[] };
export const loadStakes = memo("loadStakes:v1", async (): Promise<Stake[]> => {
  const r = await runEngine<{ stakes?: Stake[] }>("json", [{ stakes: { days: 14 } }]);
  if (r.error) throw new Error(r.error);
  return r.stakes ?? [];
});

// Poissaolokortti (6.11.2026, docs/claude/skenaario.md V6): puuttuvat vakiot viimeisimmästä
// pelatusta ottelusta ja moottorin laskema vaikutus kolmella kestolla. Joukkuekohtainen
// välimuisti (tyhjenee ennusteen vaihtuessa kuten muutkin).
export type TeamAbsence = { team: string; goal: StakeRow["goal"]; missing: { player_id: number; name: string }[]; baseline: number;
  durations: Record<"week" | "month" | "season", { p_now: number; p: number }>; show: boolean; forecastDate?: string };
export async function loadAbsence(team: string): Promise<TeamAbsence | null> {
  await fresh();
  const key = `loadAbsence:v1:${team}`;
  let p = store.values.get(key) as Promise<TeamAbsence | null> | undefined;
  if (!p) {
    p = runEngine<TeamAbsence>("absence", { team }).then((r) => (r.error ? null : r))
      .catch((e) => { store.values.delete(key); throw e; });
    store.values.set(key, p);
  }
  return p;
}

// Kauden kysymykset (6.11.2026, docs/claude/skenaario.md J2/V7): käyrä sijajakaumahistoriasta,
// lukituskysymyksen tämä päivä moottorilta ja aiemmat päivät scenario_history-taulusta
// (scripts/tools/season_questions.py), Uutiskorjattu haastajan historiasta (vain
// paikallisesti ja Pagesissa; Snowflakeen J3:ssa, kuten lukituskysymyksen historia).
export const loadSeasonQuestions = memo("loadSeasonQuestions:v2", async (): Promise<QuestionView[]> => {
  const [snaps, pos, fx, hist, news] = await Promise.all([
    loadPositionHistory().catch(() => [] as Snap[]), loadPosition(), loadFixtures(),
    query(`SELECT * FROM ${M}.SCENARIO_HISTORY ORDER BY snapshot_date`)
      .catch((e) => { if (missingTable(e)) return [] as Record<string, unknown>[]; throw e; }),
    optional(() => query(`SELECT * FROM challenger_history ORDER BY snapshot_date`)),
  ]);
  const today = String((await fresh()).meta?.UPDATED_AT ?? "").slice(0, 10);
  return Promise.all(QUESTIONS.map(async (q): Promise<QuestionView> => {
    const now = pos.find((r) => r.team === q.team);
    const plain = now ? goalP(now.p, q.goal) : null;
    let p = plain, series: QPoint[], state: LockState | undefined, sha: string | undefined;
    if (q.lock) {
      state = lockState(q.lock, fx);
      if (state === "open") {
        type R = { requirements?: { p: number }[]; scenario_sha?: string; error?: string };
        const r: R = await runEngine<R>("json", [q.lock, { team: q.team, goal: q.goal === "relegation" ? "avoid_relegation" : q.goal }])
          .catch((e) => ({ error: (e as Error).message }));
        const rp = r.requirements?.[0]?.p;
        p = r.error || rp == null ? null : q.goal === "relegation" ? 1 - rp : rp;
        sha = r.scenario_sha;
      } else if (state === "failed") p = null;
      series = hist.filter((h) => String(h.QUESTION_ID) === q.id && h.P != null)
        .map((h) => ({ date: String(h.SNAPSHOT_DATE).slice(0, 10), p: Number(h.P) }));
    } else {
      series = snaps.filter((s) => s.p[q.team]).map((s) => ({ date: s.date, p: goalP(s.p[q.team], q.goal) }));
    }
    series = series.filter((x) => x.date !== today);
    if (p != null && today) series.push({ date: today, p });
    const col = NEWS_COL[q.goal];
    const newsSeries = q.lock || !col ? [] : news.filter((r) => String(r.TEAM) === q.team && r[col] != null)
      .map((r) => ({ date: String(r.SNAPSHOT_DATE).slice(0, 10), p: Number(r[col]) }));
    return { ...q, p, base: q.lock ? plain : null, series, news: newsSeries, state, sha, ...trend(series) };
  }));
});
