// LinkedIn-diat: renderöinti scripts/local/export_linkedin.py:llä (headless
// Chrome + Python + paikallinen DuckDB), tulokset väliaikaishakemistoon
// ennusteen aikaleiman mukaan. Sama rajoite kuin Streamlitin diaosiolla:
// toimii läppärillä, ei Snowflakessa -- ja osio sanoo sen ääneen.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Sovellus on repossa polussa snowflake/LIIGA/CODE/application_services/LIIGA_ENNUSTE.
const REPO = process.env.LIIGA_REPO ?? path.resolve(process.cwd(), "../../../../..");
const PY = path.join(REPO, ".venv", "bin", "python");
const SCRIPT = path.join(REPO, "scripts", "local", "export_linkedin.py");
export const OUT = path.join(os.tmpdir(), "liiga-linkedin");

export type Asset = { key: string; title: string; file: string; description: string; pages: string[]; pdf: string | null; error: string };
export type Manifest = { updated_at: string; assets: Asset[] };

type Job = { running: boolean; log: string; error: string; stamp: string };
const job: Job = ((globalThis as { __liJob?: Job }).__liJob ??= { running: false, log: "", error: "", stamp: "" });

export function unavailable(): string | null {
  if (fs.existsSync("/snowflake/session/token")) return "Diat renderöidään headless Chromella, jota Snowflake App Runtimessa ei ole. Lataa ne paikallisesta sovelluksesta.";
  if (!fs.existsSync(PY) || !fs.existsSync(SCRIPT)) return `Python-ympäristöä ei löydy (${PY}).`;
  return null;
}

// DuckDB sallii yhden kirjoittajaprosessin, eikä lukija pääse sisään sen
// aikana. Renderöinnin ajaksi käytetään siksi sen alussa luettua aikaleimaa:
// muuten tilakysely kahden sekunnin välein kaatoi renderöinnin lukkoon.
export function currentStamp(): string {
  if (job.running && job.stamp) return job.stamp;
  const r = spawnSync(PY, [SCRIPT, "--out", OUT, "--stamp"], { cwd: REPO, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) throw new Error((r.stderr || "aikaleimaa ei saatu").trim().split("\n").pop());
  return r.stdout.trim();
}

// Sama kansionimi kuin export_linkedin.py:n stamp_dir().
export const dirName = (stamp: string) => stamp.replace(/[^A-Za-z0-9]/g, "-");
export const dirOf = (stamp: string) => path.join(OUT, dirName(stamp));

export function manifest(stamp: string): Manifest | null {
  const f = path.join(dirOf(stamp), "manifest.json");
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as Manifest) : null;
}

export function status() { return { running: job.running, log: job.log, error: job.error }; }

export function render(): boolean {
  if (job.running) return false;
  const stamp = currentStamp();
  Object.assign(job, { running: true, log: "", error: "", stamp });
  const p = spawn(PY, [SCRIPT, "--out", OUT], { cwd: REPO });
  p.stdout.on("data", (b) => { job.log += String(b); });
  p.stderr.on("data", (b) => { job.log += String(b); });
  p.on("close", (code) => {
    job.running = false;
    if (code !== 0) job.error = job.log.trim().split("\n").pop() ?? `exit ${code}`;
  });
  return true;
}
