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
import { loadTeams } from "@/lib/data";
import { runEngine } from "@/lib/scenarioEngine";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };
const GOALS = new Set(["top6", "top10", "avoid_relegation", "win"]);
const STREAKS = new Set([0, 3, 5, 10]);

const RESULTS = new Set(["home_win", "away_win", "home_reg", "home_ot", "away_ot", "away_reg"]);

// Lukittujen otteluiden skenaario (napautuslukitus, lib/lockBus.ts): vain tunnisteet ja
// tulosenumit, enintään 10. Moottori palauttaa joukkueiden luvut, uskottavuuden ja
// kanonisen skenaarion (json-tila).
async function locks(items: unknown[]) {
  const ok = items.length > 0 && items.length <= 10 && items.every((x) => {
    const o = x as { game_id?: unknown; result?: unknown };
    return Number.isInteger(o.game_id) && typeof o.result === "string" && RESULTS.has(o.result) && Object.keys(o).length === 2;
  });
  if (!ok) return NextResponse.json({ error: "virheellinen skenaario" }, { status: 400, headers: NO_STORE });
  try {
    const res = await runEngine("json", items);
    return NextResponse.json(res, { status: res.error ? 422 : 200, headers: NO_STORE });
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
