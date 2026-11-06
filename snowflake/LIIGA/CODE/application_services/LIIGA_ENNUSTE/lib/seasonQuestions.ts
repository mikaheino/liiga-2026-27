// Kauden kysymykset (6.11.2026, docs/claude/skenaario.md J2/V7). Lista: seasonQuestions.json
// (muutos vain PR:llä). Tavallisen kysymyksen käyrä on sijajakaumahistoriasta, lukituskysymyksen
// skenaariomoottorilta (tämä päivä) ja scenario_history-taulusta (aiemmat päivät,
// scripts/tools/season_questions.py). Tämä tiedosto ei laske todennäköisyyksiä: se summaa
// julkaistun sijajakauman ja lukee lukituksen tilan pelatuista otteluista.
import type { Fixture } from "@/lib/fixtures";
import list from "@/lib/seasonQuestions.json";
import { PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT, TEAMS } from "@/lib/table";

export type QGoal = "relegation" | "top6" | "top10" | "win";
export type QLock = { team: string; result: "loss" | "win"; from: string; until: string };
export type Question = { id: string; team: string; goal: QGoal; label: string; short: string; lock?: QLock };
export type QPoint = { date: string; p: number };
export type LockState = "open" | "held" | "failed";
export type QuestionView = Question & {
  p: number | null; base: number | null; series: QPoint[]; news: QPoint[]; state?: LockState; sha?: string; dWeek: number | null; dead: boolean;
};

export const QUESTIONS = list as Question[];

// Sijat, joilla tavoite toteutuu (putoaminen = 15.–17.).
const RANKS: Record<QGoal, [number, number]> = {
  relegation: [RELEGATION_CUT + 1, TEAMS], top6: [1, PLAYOFF_CUT], top10: [1, QUALI_CUT], win: [1, 1],
};
export const goalP = (p: number[], goal: QGoal) => {
  const [a, b] = RANKS[goal];
  return p.slice(a - 1, b).reduce((s, x) => s + x, 0);
};

const helsinkiDay = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });

/** Jakson pelatut ottelut: ehto rikki (failed), kaikki pelattu ja ehto piti (held) tai kesken (open). */
export function lockState(lock: QLock, fixtures: Fixture[]): LockState {
  const mine = fixtures.filter((f) => (f.home === lock.team || f.away === lock.team)
    && helsinkiDay(f.start_ts) >= lock.from && helsinkiDay(f.start_ts) <= lock.until);
  const ok = (f: Fixture) => {
    const own = f.home === lock.team ? f.hg! : f.ag!, opp = f.home === lock.team ? f.ag! : f.hg!;
    return lock.result === "loss" ? own < opp : own > opp;
  };
  const played = mine.filter((f) => f.ended && f.hg != null && f.ag != null);
  if (played.some((f) => !ok(f))) return "failed";
  return played.length < mine.length ? "open" : "held";
}

/** Viikon muutos (%-yks.) ja kuollut raja: alle 3 % tai yli 97 % seitsemän viimeistä päivää. */
export function trend(series: QPoint[]): { dWeek: number | null; dead: boolean } {
  const last = series.at(-1);
  if (!last) return { dWeek: null, dead: false };
  const weekAgo = new Date(Date.parse(last.date) - 7 * 864e5).toISOString().slice(0, 10);
  const ref = [...series].reverse().find((x) => x.date <= weekAgo);
  const tail = series.filter((x) => x.date > weekAgo);
  const dead = tail.length >= 7 && tail.every((x) => x.p < 0.03 || x.p > 0.97);
  return { dWeek: ref ? 100 * (last.p - ref.p) : null, dead };
}

/** Uutiskorjattu (haastajan) sarake kysymyksen tavoitteelle; top 10:lle ei ole dataa. */
export const NEWS_COL: Partial<Record<QGoal, string>> = {
  relegation: "P_RELEGATION_SCENARIO", top6: "P_TOP6_SCENARIO", win: "P_TITLE_SCENARIO",
};
