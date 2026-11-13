// Kanonisen skenaariorivin tarkistus palvelimella (6.11.2026): selaimelta tuleva
// skenaario saa sisältää vain moottorin kanonisia rivejä -- tunnisteita, enumeita ja
// pieniä kokonaislukuja. Ei vapaata tekstiä (paitsi joukkueen nimi listalta).
// Skenaarion rivimäärän yläraja (7.11.2026: 10 -> 64, käyttäjä: "skenaario pitäisi mennä koko
// kaudelle"): yhden joukkueen koko runkosarja. Moottorissa ei ole omaa rajaa.
// 13.11.2026: 64 -> 400, käyttäjä haluaa lukita usean joukkueen koko lopun kauden ottelu kerrallaan.
// Mitattu paikallisesti (scripts/tools/skenaario.py --json, mediaani 3 ajosta, sis. DuckDB:n luku ja
// 10 000 kauden simulointi): 10 riviä 0,80 s · 40: 0,80 · 64: 0,79 · 120: 0,79 · 200: 0,76 ·
// 300: 0,74 · 376 (kaikki pelaamattomat ottelut): 0,71 s -- aika ei kasva rivimäärän mukana, koska
// lukitut ottelut vain kiinnittävät tuloksen simulaatioon. Kaikkien pelaamattomien otteluiden lukitus
// (376 tänään, vain pienenee kauden mittaan) mahtuu, ja 400 jättää tilaa poissaolo- ja tavoiterivelle.
// Muut rajat: komentoriviargumentti 17 kt (376 riviä; macOS ~1 Mt, Linux 128 kt/argumentti),
// proseduurin VARCHAR-argumentti ja SKENAARIO_HAKU:n STRING/VARIANT 16 Mt. Tuntematon: Snowflake-proseduuria ei ajettu.
export const MAX_ITEMS = 400;
// + jatkoaika ja pisteet (7.11.2026): overtime, regulation, home_point, away_point.
const RESULTS = new Set(["home_win", "away_win", "home_reg", "home_ot", "away_ot", "away_reg", "overtime", "regulation", "home_point", "away_point"]);
const GOALS = new Set(["avoid_relegation", "top10", "top6", "win"]);
const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

export function validItem(x: unknown, teams: Set<string>): boolean {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>, keys = Object.keys(o);
  const only = (...k: string[]) => keys.every((key) => k.includes(key));
  if ("game_id" in o) return only("game_id", "result") && int(o.game_id, 1, 1e9) && RESULTS.has(String(o.result));
  if ("injury" in o) {
    const who = int(o.injury, 1, 1e9) || (typeof o.injury === "string" && /^[\p{L} .'-]{2,60}$/u.test(o.injury));
    // from/until (7.11.2026): ottelukohtainen poissaolo (säätö "maalivahti vaihtuu", uutisten pelaajat).
    const day = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if ("from" in o) return only("injury", "from", "until") && who && day(o.from) && day(o.until);
    return only("injury", "games", "ramp_games", "ramp_effect") && who && int(o.games, 0, 64)
      && (o.ramp_games === undefined || int(o.ramp_games, 0, 20))
      && (o.ramp_effect === undefined || (typeof o.ramp_effect === "number" && o.ramp_effect >= 0 && o.ramp_effect <= 1));
  }
  // Mallin säätö (7.11.2026, vaihe 1): samat rajat kuin moottorissa (simulate_scenario.py MODEL_KNOBS).
  if ("model" in o) {
    const m = o.model as Record<string, unknown>;
    if (!only("model") || !m || typeof m !== "object") return false;
    const KN: Record<string, [number, number]> = { poisson_weight: [0, 1], home_ice: [0.9, 1.3], league_avg: [2, 4], ot_scale: [0.5, 1.6], ot_lean: [0.4, 0.7] };
    return Object.entries(m).every(([k, v]) => k === "strength"
      ? !!v && typeof v === "object" && Object.entries(v as Record<string, { off?: number; def?: number }>).every(([t, f]) => teams.has(t)
        && [f.off ?? 1, f.def ?? 1].every((x) => typeof x === "number" && x >= 0.6 && x <= 1.4))
      : k in KN && typeof v === "number" && v >= KN[k][0] && v <= KN[k][1]);
  }
  // Joukkueen muutos (7.11.2026): xG-osuuden siirto ±0,15, valinnainen jakso tai otteluiden määrä.
  if ("xg_share" in o) {
    const day = (v: unknown) => v === undefined || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
    return only("team", "xg_share", "from", "until", "games") && teams.has(String(o.team)) && typeof o.xg_share === "number"
      && Math.abs(o.xg_share) <= 0.15 && day(o.from) && day(o.until) && (o.games === undefined || int(o.games, 1, 64));
  }
  if ("goal" in o) {
    return only("team", "goal", "rivals") && teams.has(String(o.team)) && GOALS.has(String(o.goal))
      && (o.rivals === undefined || (Array.isArray(o.rivals) && o.rivals.length <= 6 && o.rivals.every((r) => teams.has(String(r)))));
  }
  return false;
}
