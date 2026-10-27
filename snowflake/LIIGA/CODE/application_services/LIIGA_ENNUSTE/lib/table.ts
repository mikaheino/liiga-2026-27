// Sarjataulukon laskenta: suora käännös streamlit_app.py:n funktioista
// season_table, rank_movement, form_cells ja _spark, jotta luvut ovat samat.
import { BASE } from "@/lib/target";

export const TEAMS = 17;
export const PLAYOFF_CUT = 6;          // 1.-6. suoraan puolivälieriin
export const QUALI_CUT = 10;           // 7.-10. karsintaan
export const RELEGATION_CUT = TEAMS - 3; // 15.-17. putoaa

export type Game = {
  team: string; start_ts: string; points: number;
  goals_for: number; goals_against: number; xg_for: number | null; xg_against: number | null;
  is_home?: boolean; pp_goals?: number; pp_instances?: number; sh_instances?: number; pp_goals_against?: number;
};

export type TableRow = {
  team: string; gp: number; pts: number; w: number; otw: number; otl: number; l: number;
  gf: number; ga: number; xgShare: number | null;
};

// Järjestys pisteet -> maaliero -> tehdyt maalit: liiga.fi:n oma järjestys,
// todennettu raw_standings.rankingia vasten (CLAUDE.md). Ottelumäärä ei vaikuta.
export function seasonTable(log: Game[], teams: string[]): TableRow[] {
  const by = new Map<string, TableRow & { xgf: number; xga: number }>();
  for (const t of teams) by.set(t, { team: t, gp: 0, pts: 0, w: 0, otw: 0, otl: 0, l: 0, gf: 0, ga: 0, xgf: 0, xga: 0, xgShare: null });
  for (const g of log) {
    const r = by.get(g.team);
    if (!r) continue;
    r.gp += 1; r.pts += g.points; r.gf += g.goals_for; r.ga += g.goals_against;
    r.xgf += g.xg_for ?? 0; r.xga += g.xg_against ?? 0;
    if (g.points === 3) r.w += 1; else if (g.points === 2) r.otw += 1;
    else if (g.points === 1) r.otl += 1; else r.l += 1;
  }
  const rows = [...by.values()].map(({ xgf, xga, ...r }) => ({ ...r, xgShare: xgf + xga > 0 ? (100 * xgf) / (xgf + xga) : null }));
  return rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.team.localeCompare(b.team, "fi"));
}

// Sijamuutos: jokaiselta joukkueelta poistetaan omat viimeiset `window`
// ottelua ja taulukko lasketaan uudelleen. Vaatii vähintään 2 x window
// ottelua, muuten null (Jukurit ▲15 9.10. -opetus streamlit_app.py:ssä).
export function rankMovement(log: Game[], window: number, teams: string[]): Map<string, number | null> {
  const now = seasonTable(log, teams).map((r) => r.team);
  const byTeam = new Map<string, Game[]>();
  for (const g of [...log].sort((a, b) => a.start_ts.localeCompare(b.start_ts))) {
    (byTeam.get(g.team) ?? byTeam.set(g.team, []).get(g.team)!).push(g);
  }
  const earlier = [...byTeam.values()].flatMap((gs) => gs.slice(0, Math.max(gs.length - window, 0)));
  const then = seasonTable(earlier, teams).map((r) => r.team);
  const out = new Map<string, number | null>();
  for (const t of now) {
    const played = byTeam.get(t)?.length ?? 0;
    out.set(t, played >= 2 * window ? then.indexOf(t) - now.indexOf(t) : null);
  }
  return out;
}

export function teamPoints(log: Game[], team: string): number[] {
  return log.filter((g) => g.team === team).sort((a, b) => a.start_ts.localeCompare(b.start_ts)).map((g) => g.points);
}

// Liukuva keskiarvo, ei raakapisteitä: 3-0-3 on tasainen 2,0 eikä siksak.
export function rolling(points: number[], window: number): number[] {
  const recent = points.slice(-window);
  return recent.map((_, k) => recent.slice(0, k + 1).reduce((s, x) => s + x, 0) / (k + 1));
}

// Joukkueen logo: public/logos/<nimi ilman ääkkösiä>.png (sama kuin site/assets/logos).
export function logo(team: string): string {
  return `${BASE}/logos/${team.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}.png`;
}

// Nostokortit: kärki, kuumin ja kylmin vire (pisteet/ottelu ikkunassa) ja
// putoamisraja (sija 14 vs. 15).
export function highlights(log: Game[], teams: string[], window: number) {
  const t = seasonTable(log, teams);
  const ppg = teams
    .map((team) => {
      const p = teamPoints(log, team).slice(-window);
      return { team, games: p.length, ppg: p.length ? p.reduce((s, x) => s + x, 0) / p.length : 0 };
    })
    .filter((x) => x.games >= Math.min(window, 3));
  ppg.sort((a, b) => b.ppg - a.ppg);
  return {
    leader: t[0],
    second: t[1],
    hottest: ppg[0],
    coldest: ppg[ppg.length - 1],
    safe: t[RELEGATION_CUT - 1],
    firstDown: t[RELEGATION_CUT],
  };
}

// Koti / vieras -- streamlit_app.py:n render_split_table.
export type Side = { gp: number; pts: number; gf: number; ga: number };
export function splitTable(log: Game[], teams: string[]) {
  const empty = (): Side => ({ gp: 0, pts: 0, gf: 0, ga: 0 });
  const by = new Map(teams.map((t) => [t, { home: empty(), away: empty() }]));
  for (const g of log) {
    const r = by.get(g.team);
    if (!r) continue;
    const s = g.is_home ? r.home : r.away;
    s.gp += 1; s.pts += g.points; s.gf += g.goals_for; s.ga += g.goals_against;
  }
  return seasonTable(log, teams).map((r) => ({ team: r.team, ...by.get(r.team)! }));
}

// Maalinteko ja erikoistilanteet -- season_table:n gf_pg / pp_pct / pk_pct.
// Nollanimittäjä on "–" eikä 0 %: joukkue jolla ei ole ollut ylivoimaa, ei ole
// epäonnistunut siinä.
export function statTable(log: Game[], teams: string[]) {
  const sum = (team: string, f: (g: Game) => number) => log.filter((g) => g.team === team).reduce((s, g) => s + (f(g) || 0), 0);
  return seasonTable(log, teams).map((r) => {
    const gp = Math.max(r.gp, 1);
    const xgf = sum(r.team, (g) => g.xg_for ?? 0), xga = sum(r.team, (g) => g.xg_against ?? 0);
    const ppg = sum(r.team, (g) => g.pp_goals ?? 0), ppi = sum(r.team, (g) => g.pp_instances ?? 0);
    const shi = sum(r.team, (g) => g.sh_instances ?? 0), ppa = sum(r.team, (g) => g.pp_goals_against ?? 0);
    return {
      ...r, gfPg: r.gf / gp, gaPg: r.ga / gp, xgf, xga,
      ppGoals: ppg, ppInst: ppi, ppPct: ppi ? (100 * ppg) / ppi : null,
      shInst: shi, ppAgainst: ppa, pkPct: shi ? 100 * (1 - ppa / shi) : null,
    };
  });
}

export const fi = (x: number | null, d = 1) => (x == null || !Number.isFinite(x) ? "–" : x.toFixed(d).replace(".", ",").replace("-", "\u2212"));
