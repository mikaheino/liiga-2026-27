// Kanonisen skenaariorivin tarkistus palvelimella (6.11.2026): selaimelta tuleva
// skenaario saa sisältää vain moottorin kanonisia rivejä -- tunnisteita, enumeita ja
// pieniä kokonaislukuja. Ei vapaata tekstiä (paitsi joukkueen nimi listalta).
const RESULTS = new Set(["home_win", "away_win", "home_reg", "home_ot", "away_ot", "away_reg"]);
const GOALS = new Set(["avoid_relegation", "top10", "top6", "win"]);
const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

export function validItem(x: unknown, teams: Set<string>): boolean {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>, keys = Object.keys(o);
  const only = (...k: string[]) => keys.every((key) => k.includes(key));
  if ("game_id" in o) return only("game_id", "result") && int(o.game_id, 1, 1e9) && RESULTS.has(String(o.result));
  if ("injury" in o) {
    const who = int(o.injury, 1, 1e9) || (typeof o.injury === "string" && /^[\p{L} .'-]{2,60}$/u.test(o.injury));
    return only("injury", "games", "ramp_games", "ramp_effect") && who && int(o.games, 0, 64)
      && (o.ramp_games === undefined || int(o.ramp_games, 0, 20))
      && (o.ramp_effect === undefined || (typeof o.ramp_effect === "number" && o.ramp_effect >= 0 && o.ramp_effect <= 1));
  }
  if ("goal" in o) {
    return only("team", "goal", "rivals") && teams.has(String(o.team)) && GOALS.has(String(o.goal))
      && (o.rivals === undefined || (Array.isArray(o.rivals) && o.rivals.length <= 6 && o.rivals.every((r) => teams.has(String(r)))));
  }
  return false;
}
