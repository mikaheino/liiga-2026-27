// Napautuslukitus (6.11.2026, docs/claude/skenaario.md V4): ottelukortista lukitut
// tulokset kasautuvat yhdeksi skenaarioksi, jonka moottori laskee (app/api/skenaario,
// json-tila). Tila on katsojan oma (sessionStorage): se ei ole jaettua dataa eikä
// tallennu mihinkään muualle. Vain kanonisia tunnisteita, ei vapaata tekstiä.
export type Lock = { game_id: number; result: "home_win" | "away_win" | "home_reg" | "home_ot" | "away_ot" | "away_reg"; label: string };
const KEY = "liiga-locks", EVT = "liiga-locks";
export const MAX_LOCKS = 10;

export function getLocks(): Lock[] {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as Lock[]; } catch { return []; }
}
function save(l: Lock[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(l)); } catch { /* yksityinen ikkuna: vain muistissa */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: l }));
}
/** Sama ottelu ja tulos uudelleen = poisto; eri tulos korvaa. */
export function toggleLock(l: Lock) {
  const cur = getLocks();
  const same = cur.find((x) => x.game_id === l.game_id);
  const rest = cur.filter((x) => x.game_id !== l.game_id);
  save(same?.result === l.result ? rest : [...rest, l].slice(-MAX_LOCKS));
}
export function setLocks(l: Lock[]) { save(l.slice(0, MAX_LOCKS)); }
export function onLocks(fn: (l: Lock[]) => void) {
  const h = (e: Event) => fn(((e as CustomEvent).detail as Lock[]) ?? getLocks());
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}
