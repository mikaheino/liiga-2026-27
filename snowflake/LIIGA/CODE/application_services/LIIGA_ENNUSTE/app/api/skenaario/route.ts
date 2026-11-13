// Skenaariopaneeli (components/Scenario.tsx, 6.11.2026). Käyttäjä: "skenaariotyökalu
// jolla hahmotella mitä vaatisi esim. että KooKoo nousisi takaisin pudotuspeli-
// taisteluun ... jos KooKoo voittaisi 10 ottelua putkeen, niin tämä vaikuttaa muiden
// peleihin". Sama moottori kuin agentin työkalulla liiga_skenaario
// (simulate_scenario.py, panel()): mitä vaaditaan = ne 10 000 kaudesta, joissa tavoite
// toteutui; putki = lukitut tulokset, jotka ovat samalla vastustajien tappioita.
//   POST { team, goal, streak } -> { team, goal, base, streak?, forecastDate }
//   POST { scenario: [{ game_id, result }, ...] } -> moottorin json (napautuslukitus)
// Vastauksen muodostaa moottori, ei tämä reitti, joten se on sama kaikkialla:
//   paikallisesti  scripts/tools/skenaario.py --panel (DuckDB)
//   Snowflakessa   CALL LIIGA.MODEL.<LIIGA_SCENARIO_PROC>(?, 'panel') -- nimen _<sha>
//                  asettaa deploy-app.yml (sama versio kuin agentin työkalulla)
//   Pagesissa      esilaskettu public/skenaario/<joukkue>.json (scenario_static.py)
import { NextResponse } from "next/server";
import { loadFixtures, loadTeams } from "@/lib/data";
import { runEngine } from "@/lib/scenarioEngine";
import { MAX_ITEMS, validItem } from "@/lib/scenarioItems";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };
const GOALS = new Set(["top6", "top10", "avoid_relegation", "win"]);
const STREAKS = new Set([0, 3, 5, 10]);

// Oma skenaario (lib/lockBus.ts): vain moottorin kanonisia rivejä (lib/scenarioItems.ts),
// enintään MAX_ITEMS (400, lib/scenarioItems.ts). Moottori palauttaa joukkueiden luvut, uskottavuuden ja kanonisen skenaarion.
async function locks(items: unknown[]) {
  const teams = new Set(await loadTeams());
  if (!items.length || items.length > MAX_ITEMS || !items.every((x) => validItem(x, teams))) {
    return NextResponse.json({ error: "virheellinen skenaario" }, { status: 400, headers: NO_STORE });
  }
  try {
    // Tallennettu skenaario voi sisältää jo pelattuja otteluita (7.11.2026, käyttäjä: "entä jos
    // tallennettu skenaario on muuttunut"): moottori ei löydä niitä pelaamattomista, joten ne
    // pudotetaan ja lasketaan uudelleen. Silmukka pudottaa moottorin virheilmoituksesta vain yhden
    // ottelun kerrallaan (~0,8 s/kierros), joten 13.11.2026 (raja 400) jo pelatut ottelut karsitaan ensin
    // otteluluettelosta; moottorin silmukka jää varalle (enintään MAX_ITEMS kierrosta = rivien määrä).
    let rest = items as Record<string, unknown>[];
    const dropped: unknown[] = [];
    const played = new Set((await loadFixtures().catch(() => [])).filter((f) => f.ended && f.gameId != null).map((f) => Number(f.gameId)));
    for (const x of rest) if ("game_id" in x && played.has(Number(x.game_id))) dropped.push(Number(x.game_id));
    rest = rest.filter((x) => !("game_id" in x && played.has(Number(x.game_id))));
    if (!rest.length) return NextResponse.json({ error: "kaikki lukitut ottelut on jo pelattu", dropped }, { status: 422, headers: NO_STORE });
    for (let k = 0; k <= MAX_ITEMS; k++) {
      const res = await runEngine("json", rest);
      const gone = /ottelua (\d+) ei löydy pelaamattomista/.exec(String(res.error ?? ""));
      if (!gone) return NextResponse.json({ ...res, dropped }, { status: res.error ? 422 : 200, headers: NO_STORE });
      dropped.push(Number(gone[1]));
      rest = rest.filter((x) => Number(x.game_id) !== Number(gone[1]));
      if (!rest.length) return NextResponse.json({ error: "kaikki lukitut ottelut on jo pelattu", dropped }, { status: 422, headers: NO_STORE });
    }
    return NextResponse.json({ error: "skenaariota ei voitu laskea" }, { status: 422, headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502, headers: NO_STORE });
  }
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { team?: unknown; goal?: unknown; streak?: unknown; scenario?: unknown };
  if (Array.isArray(b.scenario)) return locks(b.scenario);
  const team = typeof b.team === "string" ? b.team : "", goal = typeof b.goal === "string" ? b.goal : "";
  const streak = Number(b.streak ?? 0);
  if (!(await loadTeams()).includes(team) || !GOALS.has(goal) || !STREAKS.has(streak)) {
    return NextResponse.json({ error: "virheellinen skenaario" }, { status: 400, headers: NO_STORE });
  }
  try {
    const res = await runEngine("panel", { team, goal, streak });
    return NextResponse.json(res, { status: res.error ? 422 : 200, headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502, headers: NO_STORE });
  }
}
