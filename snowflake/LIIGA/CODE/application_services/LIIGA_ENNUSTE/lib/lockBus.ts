// Oma skenaario (6.11.2026, docs/claude/skenaario.md V4-V5): ottelukortista lukitut
// tulokset ja omin sanoin kuvatut skenaariot kasautuvat yhdeksi skenaarioksi, jonka
// moottori laskee (app/api/skenaario, json-tila). Rivit ovat moottorin kanonisia
// rivejä (vain tunnisteita ja enumeita + moottorin kirjoittama label), ei käyttäjän
// tekstiä. Tila on katsojan oma (sessionStorage) eikä tallennu muualle.
export type GameLock = { game_id: number; result: "home_win" | "away_win" | "home_reg" | "home_ot" | "away_ot" | "away_reg"
  | "overtime" | "regulation" | "home_point" | "away_point"; label: string };
export type Injury = { injury: number | string; games?: number; from?: string; until?: string; ramp_games?: number; ramp_effect?: number; label: string };
export type Goal = { team: string; goal: "avoid_relegation" | "top10" | "top6" | "win"; rivals?: string[]; label: string };
// Joukkueen muutos (7.11.2026, esim. valmentajanvaihto): xG-osuuden siirto jaksolle.
export type Shift = { team: string; xg_share: number; from?: string; until?: string; games?: number; label: string };
// Mallin säätö (7.11.2026, vaihe 1): kokeiluversio, virallinen ennuste ei muutu.
export type ModelAdj = { model: { poisson_weight?: number; home_ice?: number; league_avg?: number; ot_scale?: number; ot_lean?: number;
  strength?: Record<string, { off: number; def: number }> }; label: string };
export type Item = GameLock | Injury | Goal | Shift | ModelAdj;
/** @deprecated nimi V4:stä */
export type Lock = GameLock;
const KEY = "liiga-locks", EVT = "liiga-locks";
export { MAX_ITEMS as MAX_LOCKS } from "@/lib/scenarioItems";
import { MAX_ITEMS as MAX_LOCKS } from "@/lib/scenarioItems";

export const itemKey = (i: Item) =>
  "game_id" in i ? `g:${i.game_id}` : "injury" in i ? `i:${i.injury}` : "xg_share" in i ? `s:${i.team}` : "model" in i ? "m" : `t:${i.team}:${i.goal}`;
/** Moottorille: label pois. */
export const engineItem = (i: Item) => Object.fromEntries(Object.entries(i).filter(([k]) => k !== "label"));

export function getLocks(): Item[] {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as Item[]; } catch { return []; }
}
function save(l: Item[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(l)); } catch { /* yksityinen ikkuna: vain muistissa */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: l }));
}
/** Sama ottelu ja tulos uudelleen = poisto; eri tulos korvaa. */
export function toggleLock(l: GameLock) {
  const cur = getLocks();
  const same = cur.find((x) => itemKey(x) === itemKey(l)) as GameLock | undefined;
  const rest = cur.filter((x) => itemKey(x) !== itemKey(l));
  save(same?.result === l.result ? rest : [...rest, l].slice(-MAX_LOCKS));
}
/** Uudet rivit korvaavat saman avaimen vanhat (esim. sama ottelu eri tuloksella). */
export function mergeItems(add: Item[]) {
  const keys = new Set(add.map(itemKey));
  save([...getLocks().filter((x) => !keys.has(itemKey(x))), ...add].slice(-MAX_LOCKS));
}
export function setLocks(l: Item[]) { save(l.slice(0, MAX_LOCKS)); }
export function onLocks(fn: (l: Item[]) => void) {
  const h = (e: Event) => fn(((e as CustomEvent).detail as Item[]) ?? getLocks());
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}
