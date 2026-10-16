// Datan haku sivuille. Jokainen lataaja on React cache():n takana, joten saman
// pyynnön eri komponentit jakavat yhden kyselyn, ja jokainen sivu hakee vain
// sen mitä näyttää -- etusivu ei maksa otteluhistorian hakua.
import { cache } from "react";
import type { PositionRow } from "@/components/Heatmap";
import type { HistoryPoint, TitleRow } from "@/components/TitleRace";
import type { Fixture } from "@/lib/fixtures";
import { query } from "@/lib/snowflake";
import type { Game } from "@/lib/table";

const M = "LIIGA.MODEL";
const num = (v: unknown) => (v == null ? null : Number(v));

export const loadMeta = cache(async () => {
  const [meta, next] = await Promise.all([
    query<{ UPDATED_AT: string; GAMES_PLAYED: number; GAMES_TOTAL: number }>(
      `SELECT updated_at, games_played, games_total FROM ${M}.PREDICTION_META`),
    query<{ D: string; N: number }>(`
      SELECT TO_CHAR(MIN(game_date), 'YYYY-MM-DD') AS d,
             COUNT_IF(game_date = (SELECT MIN(game_date) FROM ${M}.V_UPCOMING_PREDICTIONS)) AS n
      FROM ${M}.V_UPCOMING_PREDICTIONS`),
  ]);
  return { meta: meta[0], next: next[0] };
});

export const loadTeams = cache(async () => {
  const t = await query<{ TEAM: string }>(`
    SELECT DISTINCT home_team AS team FROM ${M}.STG_GAMES
    WHERE season = (SELECT MAX(season) FROM ${M}.STG_GAMES)`);
  return t.map((r) => r.TEAM).sort((a, b) => a.localeCompare(b, "fi"));
});

export const loadPosition = cache(async () => {
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

export const loadLog = cache(async (): Promise<Game[]> => {
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

export const loadHistory = cache(async () => {
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
export const loadFixtures = cache(async (): Promise<Fixture[]> => {
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

// URL-parametrit, jotka kulkevat sivulta toiselle (korostus ja ikkuna).
export type Params = Record<string, string | undefined>;
export function highlightOf(sp: Params, teams: string[]) {
  return new Set((sp.joukkue ?? "").split(",").map((s) => s.trim()).filter((s) => teams.includes(s)));
}
// Linkki toiselle sivulle kantaa mukanaan vain yhteiset valinnat; saman sivun
// linkki (sama polku) säilyttää myös sivun omat, kuten välilehden ja kuukauden.
const CARRY = ["joukkue", "ikkuna", "kayra", "xg"];
export function hrefWith(path: string, sp: Params, changes: Record<string, string | null> = {}, samePage = false) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && (samePage || CARRY.includes(k))) q.set(k, v);
  for (const [k, v] of Object.entries(changes)) { if (v) q.set(k, v); else q.delete(k); }
  return q.size ? `${path}?${q}` : path;
}

export const teamHref = (team: string) => `/joukkue/${encodeURIComponent(team)}`;
