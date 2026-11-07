// Datasta muodostetut hakuehdotukset (7.11.2026, käyttäjä: "Lisää vaihtelua, 10x"). Uutisten rinnalle
// kysymyksiä, jotka syntyvät ennusteesta ja otteluohjelmasta: kärkikamppailu, rajat (6., 10., 15.),
// putoamistaistelu, lähipäivien tiukat ottelut, putket, joulun yli -jaksot, valmentajanvaihto ja
// tahti. Joukkueen nimi vain perusmuodossa. seed sekoittaa joka latauksella.
import type { Fixture } from "@/lib/fixtures";
import type { Suggestion } from "@/lib/newsSuggestions";

type Pos = { team: string; projRank: number; p: number[] };

// Pieni deterministinen satunnaislukugeneraattori (mulberry32), jotta sama seed = sama lista.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle<T>(xs: T[], seed: number): T[] {
  const r = rng(seed), a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const fiDay = (ts: string) => {
  const d = new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  return `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`;
};

export function dataSuggestions(pos: Pos[], fixtures: Fixture[], today: string, stamp: string, seed: number, max = 14): Suggestion[] {
  if (!pos.length) return [];
  const r = rng(seed + 7);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const by = [...pos].sort((a, b) => a.projRank - b.projRank);
  const zone = (t: Pos, a: number, b: number) => t.p.slice(a - 1, b).reduce((x, y) => x + y, 0);
  const top = by.slice(0, 3), mid = by.filter((t) => zone(t, 1, 6) > 0.15 && zone(t, 1, 6) < 0.85),
    edge = by.filter((t) => zone(t, 1, 10) > 0.2 && zone(t, 1, 10) < 0.8), bottom = by.filter((t) => zone(t, 15, 17) >= 0.15);
  const meta = `Ennuste ${stamp}`;
  const pool: Suggestion[] = [];
  const add = (q: string, m = meta) => pool.push({ kind: "data", q, meta: m });
  const n = () => pick([3, 4, 5, 6, 8, 10]);

  // Kärkikamppailu
  const [l1, l2, l3] = top;
  if (l1 && l2) {
    add(`Kuka voittaa runkosarjan, jos ${l1.team} häviää ${n()} seuraavaa?`);
    add(`Entä jos ${l2.team} voittaa kaikki joulukuun ottelunsa?`);
    add(`Mitä ${l2.team} tarvitsee ohittaakseen ${l1.team} -joukkueen?`.replace(" -joukkueen", "-joukkueen"));
    add(`Entä jos ${l1.team} voittaa ${n()} seuraavaa – ratkeaako kärki?`);
    if (l3) add(`Entä jos ${l3.team} voittaa joulun yli kaikki?`);
  }
  // Kuuden ja kymmenen raja
  for (const t of mid.slice(0, 4)) {
    add(pick([`Entä jos ${t.team} voittaa ${n()} seuraavaa ottelua?`, `Montako pistettä ${t.team} tarvitsee kärkikuusikkoon?`,
      `Entä jos ${t.team} pelaa loppukauden kuin kärkijoukkue?`, `Nouseeko ${t.team} kärkikuusikkoon, jos se voittaa joulun yli kaikki?`]));
  }
  for (const t of edge.slice(0, 4)) {
    add(pick([`Entä jos ${t.team} häviää ${n()} seuraavaa?`, `Entä jos ${t.team} voittaa joka toisen loppukauden ottelun?`,
      `Mitä ${t.team} tarvitsee päästäkseen jatkoon?`, `Entä jos ${t.team} vaihtaa valmentajaa?`, `Entä jos ${t.team} hankkii tähtipelaajan?`]));
  }
  // Putoamistaistelu
  for (const t of bottom.slice(0, 4)) {
    add(pick([`Entä jos ${t.team} voittaa kaikki kotiottelunsa joulukuussa?`, `Mitä ${t.team} tarvitsee pysyäkseen sarjassa?`,
      `Entä jos ${t.team} vaihtaa valmentajaa?`, `Entä jos ${t.team} häviää joulun yli kaikki?`, `Entä jos ${t.team} voittaa ${n()} seuraavaa ottelua?`,
      `Entä jos ${t.team} kerää loppukauden 1,5 pistettä ottelussa?`]));
  }
  // Lähipäivien tiukat ottelut (ennusteessa lähellä toisiaan tai rajojen molemmin puolin).
  const rank = new Map(by.map((t) => [t.team, t.projRank]));
  const soon = fixtures.filter((f) => !f.ended && f.start_ts.slice(0, 10) >= today).slice(0, 40)
    .filter((f) => Math.abs((rank.get(f.home) ?? 0) - (rank.get(f.away) ?? 0)) <= 3);
  for (const f of shuffle(soon, seed).slice(0, 4)) {
    const d = fiDay(f.start_ts), m = `Ottelu ${d}`;
    add(pick([`Mitä jos ${f.away} voittaa vieraissa ${d} (${f.home}–${f.away})?`, `Entä jos ${f.home} voittaa ${f.home}–${f.away} ${d}?`,
      `Mitä ${f.home}–${f.away} ${d} ratkaisee?`, `Entä jos ${f.home}–${f.away} ${d} menee jatkoajalle?`]), m);
  }
  return shuffle(pool, seed).slice(0, max);
}
