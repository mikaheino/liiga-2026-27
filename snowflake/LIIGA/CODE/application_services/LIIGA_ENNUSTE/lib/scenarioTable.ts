// Skenaarion lopputaulukko (13.11.2026, components/ScenarioTable.tsx). Omistaja lukitsi "KooKoo häviää
// kaikki kotiottelunsa" ja sai hakutulosmaisen listan ("KooKoo: Putoaa 91 → 100 %"): "Tämä tulos ei kerro
// minulle suoraan mitään ... sarjataulukko on se mikä kiinnostaa". Tässä taulukon puhdas logiikka
// (järjestys, muutosmerkit, muotoilu, puhelimen oletussarake), jotta se on testattavissa ilman Reactia
// (tests/scenarioTable.test.ts). Ei @/-tuonteja: node --test ajaa tiedoston sellaisenaan.

export type Measure = "top10" | "top6" | "rel" | "title";
/** Sarakkeet näyttöjärjestyksessä; "Jatkoon" = sijat 1–10 (käyttäjän kieli 7.11.2026). */
export const MEASURES: [Measure, string][] = [["top10", "Jatkoon"], ["top6", "Top 6"], ["rel", "Putoaa"], ["title", "Voitto"]];
const ENGINE: Record<Measure, string> = { top10: "p_top10", top6: "p_top6", rel: "p_relegation", title: "p_title" };

export type Probs = Record<Measure, number>;
/** Yksi taulukon rivi. *Now-kentät puuttuvat pohjataulukosta (ei skenaariota = ei muutosmerkkejä). */
export type TRow = { team: string; rank: number; points: number; p: Probs; rankNow?: number; pointsNow?: number; pNow?: Probs };
/** Julkaistu ennuste ennen skenaariota (app/page.tsx, loadPosition): todennäköisyydet 0–1. */
export type Baseline = { team: string; rank: number; points: number } & Probs;

type EngineRow = { team: string } & Record<string, number | string>;
const n = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);

/** Moottorin rivit (res.teams) skenaarion sijan mukaan; tasatilanteessa pisteet, sitten nimi. */
export function fromEngine(teams: EngineRow[]): TRow[] {
  return teams.map((r) => ({
    team: String(r.team), rank: n(r.rank_scenario), points: n(r.points_scenario),
    rankNow: n(r.rank_now), pointsNow: n(r.points_now),
    p: Object.fromEntries(MEASURES.map(([k]) => [k, n(r[`${ENGINE[k]}_scenario`])])) as Probs,
    pNow: Object.fromEntries(MEASURES.map(([k]) => [k, n(r[`${ENGINE[k]}_now`])])) as Probs,
  })).sort(order);
}

/** Pohjataulukko: nykyinen ennuste ilman muutoksia. */
export function fromBaseline(rows: Baseline[]): TRow[] {
  return rows.map((r) => ({ team: r.team, rank: r.rank, points: r.points, p: { top10: r.top10, top6: r.top6, rel: r.rel, title: r.title } })).sort(order);
}

function order(a: TRow, b: TRow) { return a.rank - b.rank || b.points - a.points || a.team.localeCompare(b.team, "fi"); }

/** Sijan muutos: pienempi sija = nousu. Muoto ei ole vain väri: ▲2 / ▼1 / –. Pohjassa ei merkkiä. */
export function rankMove(r: TRow): { text: string; dir: "up" | "down" | "same" | null; say: string } {
  if (r.rankNow == null) return { text: "", dir: null, say: "" };
  const d = r.rankNow - r.rank;
  if (!d) return { text: "–", dir: "same", say: "sija ennallaan" };
  return d > 0 ? { text: `▲${d}`, dir: "up", say: `nousee ${d} ${d === 1 ? "sijan" : "sijaa"}` }
    : { text: `▼${-d}`, dir: "down", say: `laskee ${-d} ${d === -1 ? "sijan" : "sijaa"}` };
}

const MINUS = "−";
const signed = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `${MINUS}${-d}` : "±0");

/** Pisteet kokonaislukuina; muutos lasketaan pyöristetyistä, jotta "49 · −23" täsmää nykyiseen 72:een. */
export function pointsText(r: TRow): { value: string; delta: string } {
  const v = Math.round(r.points);
  return { value: String(v), delta: r.pointsNow == null ? "" : signed(v - Math.round(r.pointsNow)) };
}

/** Todennäköisyys prosentteina: "<1" ja ">99" ääripäissä, 0 ja 100 vain tarkkoina. */
export function pctText(p: number): string {
  const x = 100 * p;
  if (x <= 0) return "0";
  if (x >= 100) return "100";
  if (x < 0.5) return "<1";
  if (x >= 99.5) return ">99";
  return String(Math.round(x));
}

/** Muutos prosenttiyksikköinä; alle puolen yksikön muutos ei näy (tyhjä). */
export function ppText(now: number | undefined, scn: number): string {
  if (now == null) return "";
  const d = Math.round(100 * (scn - now));
  return d ? signed(d) : "";
}

/** Rivi liikkui "selvästi": sija vaihtui, pisteet ≥ 2 tai jokin todennäköisyys ≥ 3 prosenttiyksikköä.
 *  KooKoon kotitappioissa lähes kaikki saavat noin pisteen lisää, joten 1 p:n raja merkitsisi kaikki. */
export const MOVED_POINTS = 2, MOVED_PP = 0.03;
export function moved(r: TRow): boolean {
  if (r.rankNow == null || r.pointsNow == null || !r.pNow) return false;
  return r.rank !== r.rankNow || Math.abs(r.points - r.pointsNow) >= MOVED_POINTS
    || MEASURES.some(([k]) => Math.abs(r.p[k] - r.pNow![k]) >= MOVED_PP);
}

/** Puhelimen ainoa todennäköisyyssarake: se, joka liikkuu eniten skenaarion joukkueilla (muuten koko
 *  liigassa); ei liikettä tai pohjataulukko -> Jatkoon. KooKoon kotitappiot -> Putoaa (91 -> 100 %). */
export function defaultMeasure(rows: TRow[], focus: string[]): Measure {
  const own = rows.filter((r) => focus.includes(r.team));
  const pool = own.length ? own : rows;
  let best: Measure = "top10", top = 0;
  for (const [k] of MEASURES) {
    const s = pool.reduce((a, r) => a + (r.pNow ? Math.abs(r.p[k] - r.pNow[k]) : 0), 0);
    if (s > top + 1e-9) { best = k; top = s; }
  }
  return top >= 0.005 ? best : "top10";
}

/** Vyöhykkeet (lib/table.ts: PLAYOFF_CUT 6, QUALI_CUT 10, RELEGATION_CUT 14): otsikko ennen sijaa `from`. */
export const ZONES: { from: number; to: number; text: string; k: string }[] = [
  { from: 1, to: 6, text: "suoraan puolivälieriin", k: "po" },
  { from: 7, to: 10, text: "karsintaan", k: "q" },
  { from: 11, to: 14, text: "kausi päättyy runkosarjaan", k: "mid" },
  { from: 15, to: 17, text: "putoamisviivan alla", k: "rel" },
];
