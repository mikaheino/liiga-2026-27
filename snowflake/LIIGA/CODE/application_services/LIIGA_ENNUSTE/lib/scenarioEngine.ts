// Skenaariomoottorin kutsu kaikista ympäristöistä (6.11.2026, docs/claude/skenaario.md).
// Yksi moottori (simulate_scenario.py), kolme kuorta:
//   paikallisesti ja Pagesin käännöksessä  scripts/tools/skenaario.py (DuckDB)
//   Snowflakessa                            CALL LIIGA.MODEL.<LIIGA_SCENARIO_PROC>(?, MODE)
// TypeScript ei laske lukuja: se välittää pyynnön ja palauttaa moottorin JSONin.
import { spawn } from "node:child_process";
import path from "node:path";
import { DATA_MODE, query } from "@/lib/snowflake";

const REPO = process.env.LIIGA_REPO ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../../../..");
const PROC = process.env.LIIGA_SCENARIO_PROC ?? "";

export type EngineMode = "json" | "panel";

function local(mode: EngineMode, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(path.join(REPO, ".venv/bin/python"), [path.join(REPO, "scripts/tools/skenaario.py"), `--${mode}`, payload], { cwd: REPO });
    let out = "", err = "";
    p.stdout.on("data", (b) => { out += b; }); p.stderr.on("data", (b) => { err += b; });
    p.on("error", reject);
    p.on("close", () => (out.trim() ? resolve(out) : reject(new Error(err.trim().split("\n").pop() || "simulaatio epäonnistui"))));
  });
}

async function snowflake(mode: EngineMode, payload: string): Promise<string> {
  // Nimi tulee ympäristömuuttujasta (deploy-app.yml), ei käyttäjältä; muoto tarkistetaan silti.
  if (!/^SIMULATE_SCENARIO_[A-Z0-9]+$/.test(PROC)) throw new Error("skenaarioproseduuria ei ole määritetty");
  const rows = await query<Record<string, string>>(`CALL LIIGA.MODEL.${PROC}(?, ?)`, [payload, mode]);
  return String(Object.values(rows[0] ?? {})[0] ?? "");
}

/** Moottorin vastaus olioksi; virhe tulee kenttään `error`. */
export async function runEngine<T = Record<string, unknown>>(mode: EngineMode, payload: unknown): Promise<T & { error?: string }> {
  const s = JSON.stringify(payload);
  return JSON.parse(await (DATA_MODE === "snowflake" ? snowflake(mode, s) : local(mode, s)));
}
