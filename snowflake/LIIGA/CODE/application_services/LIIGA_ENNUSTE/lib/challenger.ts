// Uutishaastaja vs. lukittu malli pelatuista otteluista (27.10.). Molemmat
// ennusteet on kirjattu ennen ottelua: lukittu = aamun ennuste, haastaja = sama
// + poissaolot ja aloittava maalivahti klo 14 (scripts/news/challenger.py).
import type { Challenger } from "@/lib/data";
import type { Fixture } from "@/lib/fixtures";

const hkiDay = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
export const gameKey = (date: string, home: string, away: string) => `${date}|${home}|${away}`;
export const fixtureKey = (f: Fixture) => gameKey(hkiDay(f.start_ts), f.home, f.away);

export type AbRow = Challenger & { y: number; llBase: number; llNews: number };
export type Ab = { n: number; llBase: number; llNews: number; hitsBase: number; hitsNews: number; changed: number; rows: AbRow[] };

const ll = (y: number, p: number) => { const q = Math.min(Math.max(p, 1e-9), 1 - 1e-9); return -(y * Math.log(q) + (1 - y) * Math.log(1 - q)); };

export function abScore(ch: Challenger[], fixtures: Fixture[]): Ab {
  const done = new Map(fixtures.filter((f) => f.ended && f.hg != null && f.ag != null).map((f) => [fixtureKey(f), f]));
  const rows: AbRow[] = [];
  for (const c of ch) {
    const f = done.get(gameKey(c.date, c.home, c.away));
    if (!f) continue;
    const y = f.hg! > f.ag! ? 1 : 0;
    rows.push({ ...c, y, llBase: ll(y, c.base), llNews: ll(y, c.pHome) });
  }
  const n = rows.length, mean = (k: "llBase" | "llNews") => (n ? rows.reduce((s, r) => s + r[k], 0) / n : 0);
  const hits = (k: "base" | "pHome") => rows.filter((r) => (r[k] >= 0.5 ? 1 : 0) === r.y).length;
  return { n, llBase: mean("llBase"), llNews: mean("llNews"), hitsBase: hits("base"), hitsNews: hits("pHome"),
    changed: rows.filter((r) => Math.abs(r.pHome - r.base) >= 0.005).length, rows };
}
