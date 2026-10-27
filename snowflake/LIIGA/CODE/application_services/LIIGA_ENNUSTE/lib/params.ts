// URL-parametrit, jotka kulkevat sivulta toiselle (korostus ja ikkuna). Omassa
// tiedostossaan, koska selaimessa ajettavat näkymät (components/views) käyttävät
// näitä eivätkä saa tuoda lib/data.ts:ää (Snowflake-yhteys, Python-silta).
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
