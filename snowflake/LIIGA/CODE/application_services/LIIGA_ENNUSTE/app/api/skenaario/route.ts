// Skenaariopaneeli (components/Scenario.tsx, 6.11.2026). Käyttäjä: "skenaariotyökalu
// jolla hahmotella mitä vaatisi esim. että KooKoo nousisi takaisin pudotuspeli-
// taisteluun ... jos KooKoo voittaisi 10 ottelua putkeen, niin tämä vaikuttaa muiden
// peleihin". Sama moottori kuin agentin työkalulla liiga_skenaario
// (simulate_scenario.py, panel()): mitä vaaditaan = ne 10 000 kaudesta, joissa tavoite
// toteutui; putki = lukitut tulokset, jotka ovat samalla vastustajien tappioita.
//   POST { team, goal, streak } -> { team, goal, base, streak?, forecastDate }
// Vastauksen muodostaa moottori, ei tämä reitti, joten se on sama kaikkialla:
//   paikallisesti  scripts/tools/skenaario.py --panel (DuckDB)
//   Snowflakessa   CALL LIIGA.MODEL.<LIIGA_SCENARIO_PROC>(?, 'panel') -- nimen _<sha>
//                  asettaa deploy-app.yml (sama versio kuin agentin työkalulla)
//   Pagesissa      esilaskettu public/skenaario/<joukkue>.json (scenario_static.py)
import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { loadTeams } from "@/lib/data";
import { DATA_MODE, query } from "@/lib/snowflake";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };
const GOALS = new Set(["top6", "top10", "avoid_relegation", "win"]);
const STREAKS = new Set([0, 3, 5, 10]);
const REPO = process.env.LIIGA_REPO ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../../../..");
const PROC = process.env.LIIGA_SCENARIO_PROC ?? "";

function local(request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(path.join(REPO, ".venv/bin/python"), [path.join(REPO, "scripts/tools/skenaario.py"), "--panel", request], { cwd: REPO });
    let out = "", err = "";
    p.stdout.on("data", (b) => { out += b; }); p.stderr.on("data", (b) => { err += b; });
    p.on("error", reject);
    p.on("close", () => (out.trim() ? resolve(out) : reject(new Error(err.trim().split("\n").pop() || "simulaatio epäonnistui"))));
  });
}

async function snowflake(request: string): Promise<string> {
  // Nimi tulee ympäristömuuttujasta (ei käyttäjältä); muoto tarkistetaan silti.
  if (!/^SIMULATE_SCENARIO_[A-Z0-9]+$/.test(PROC)) throw new Error("skenaarioproseduuria ei ole määritetty");
  const rows = await query<Record<string, string>>(`CALL LIIGA.MODEL.${PROC}(?, 'panel')`, [request]);
  return String(Object.values(rows[0] ?? {})[0] ?? "");
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { team?: unknown; goal?: unknown; streak?: unknown };
  const team = typeof b.team === "string" ? b.team : "", goal = typeof b.goal === "string" ? b.goal : "";
  const streak = Number(b.streak ?? 0);
  if (!(await loadTeams()).includes(team) || !GOALS.has(goal) || !STREAKS.has(streak)) {
    return NextResponse.json({ error: "virheellinen skenaario" }, { status: 400, headers: NO_STORE });
  }
  const request = JSON.stringify({ team, goal, streak });
  try {
    const res = JSON.parse(await (DATA_MODE === "snowflake" ? snowflake(request) : local(request)));
    return NextResponse.json(res, { status: res.error ? 422 : 200, headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502, headers: NO_STORE });
  }
}
