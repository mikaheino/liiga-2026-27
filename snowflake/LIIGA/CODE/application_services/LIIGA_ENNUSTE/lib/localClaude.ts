// Paikallinen "Kysy agentilta" (17.10.): koneella ajettaessa keskustelu käyttää
// paikallista Claude Codea (`claude -p`) eikä Snowflaken agenttia. Claude saa
// ilman työkaluja tiiviin tilannekuvan samasta datasta kuin sivut (DuckDB), joten
// se vastaa vain siitä mitä tiedetään -- Snowflaken agentilla on enemmän työkaluja
// (mitä jos -simulaattori, kokoonpanot, tietopankki).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Turn } from "@/lib/agent";
import { loadFixtures, loadHistory, loadLog, loadMeta, loadPosition, loadTeams } from "@/lib/data";
import { modelSaid, scoreboard } from "@/lib/fixtures";
import { seasonTable, teamPoints } from "@/lib/table";

// Claude Code asentuu ~/.local/bin:iin, joka ei aina ole palvelinprosessin PATHissa.
const CLAUDE = process.env.CLAUDE_BIN ?? [path.join(os.homedir(), ".local/bin/claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude"].find((p) => fs.existsSync(p)) ?? "claude";
const f1 = (x: number) => x.toFixed(1).replace(".", ",");
const day = (ts: string) => `${Number(ts.slice(8, 10))}.${Number(ts.slice(5, 7))}.`;

async function context(): Promise<string> {
  const [{ meta }, pos, log, teams, fx, { history, preseason }] = await Promise.all([loadMeta(), loadPosition(), loadLog(), loadTeams(), loadFixtures(), loadHistory()]);
  const latest = history.length ? history[history.length - 1].date : "";
  const now = new Map(history.filter((h) => h.date === latest).map((h) => [h.team, h.points]));
  const table = seasonTable(log, teams);
  const played = fx.filter((f) => f.ended), coming = fx.filter((f) => !f.ended);
  const sb = scoreboard(fx);
  const res = (f: typeof fx[number]) => `${f.hg}-${f.ag}${f.category === "overtime" ? " ja" : f.category === "shootout" ? " vl" : ""}`;
  return [
    `Ennuste päivitetty ${meta?.UPDATED_AT ?? "?"}; pelattu ${meta?.GAMES_PLAYED}/${meta?.GAMES_TOTAL} ottelua (64 per joukkue).`,
    "ENNUSTETTU LOPPUTAULUKKO (sija, joukkue, pisteet 5-95 %, runkosarjan voitto %, sijat 1-6 %, sijat 7-10 %, putoaminen 15-17 %, muutos esikaudesta):",
    ...pos.map((r) => { const s = (a: number, b: number) => r.p.slice(a - 1, b).reduce((x, y) => x + y, 0) * 100; const base = preseason.get(r.team);
      return `${r.projRank}. ${r.team}: ${Math.round(r.points)} p (${Math.round(r.p05)}-${Math.round(r.p95)}), voitto ${f1(r.pTitle)} %, 1-6 ${f1(s(1, 6))} %, 7-10 ${f1(s(7, 10))} %, putoaa ${f1(s(15, 17))} %${base != null && now.has(r.team) ? `, esikaudesta ${now.get(r.team)! - base >= 0 ? "+" : ""}${f1(now.get(r.team)! - base)}` : ""}`; }),
    "SARJATAULUKKO NYT (liiga.fi:n järjestys; O, V-JV-JH-H, maalit, pisteet, viimeiset 5 pisteinä 3/2/1/0):",
    ...table.map((r, i) => `${i + 1}. ${r.team}: O ${r.gp}, ${r.w}-${r.otw}-${r.otl}-${r.l}, ${r.gf}-${r.ga}, ${r.pts} p, vire ${teamPoints(log, r.team).slice(-5).join(" ")}`),
    `MALLIN OSUVUUS: voittaja oikein ${sb.hits}/${sb.n}; aina kotijoukkue olisi osunut ${sb.home}/${sb.n}.`,
    "VIIMEISIMMÄT TULOKSET (mallin todennäköisyys voittajalle):",
    ...played.slice(-12).map((f) => `${day(f.start_ts)} ${f.home}-${f.away} ${res(f)}${modelSaid(f) != null ? `, malli antoi voittajalle ${Math.round(modelSaid(f)!)} %` : ""}`),
    "TULEVAT OTTELUT (kotivoiton todennäköisyys jatkoajat mukaan, jatkoajan todennäköisyys):",
    ...coming.slice(0, 16).map((f) => `${day(f.start_ts)} ${f.home}-${f.away}: koti ${f.pHome == null ? "?" : Math.round(f.pHome * 100)} %, jatkoaika ${f.pOt == null ? "?" : Math.round(f.pOt * 100)} %`),
  ].join("\n");
}

const SYSTEM = `Olet Liiga Ennustaja, Liigan kauden 2026-27 asiallinen analyytikko tämän projektin ennustemallin pohjalta. Vastaa AINA suomeksi.
Käytä vain alla annettua tilannekuvaa; älä keksi lukuja. Jos kysytty asia ei ole tilannekuvassa (esim. pelaajatilastot, kokoonpanot, mitä jos -laskelmat), sano yhdellä lauseella, että paikallinen versio ei sitä tiedä ja että Snowflaken agentti osaa sen.
Lyhyesti: vastaus yhdellä lauseella, tarvittaessa enintään 10 rivin taulukko, enintään kaksi lausetta tulkintaa. Prosentit yhdellä desimaalilla, desimaalipilkku.
"Mestaruus" tarkoittaa tässä runkosarjan voittoa: malli ei ennusta pudotuspelejä. Vyöhykkeet: 1-6 puolivälierät, 7-10 karsinta, 15-17 putoaa. Vertaa mallin osuvuutta siihen, että kotijoukkue voittaa aina.
Vedonlyönnistä: anna luvut, älä kehota pelaamaan.
Lopeta joukkueita koskeva vastaus rivillä "Lisää sovelluksessa: /joukkue/<Joukkue>" ja muut sopivalla sivulla (/sarjataulukko, /voittaja, /ottelut, /liike).
Kirjoita aivan viimeiseksi riviksi kolme lyhyttä jatkokysymystä, joita käyttäjä voisi kysyä seuraavaksi, muodossa "JATKO: kysymys 1 | kysymys 2 | kysymys 3".`;

export async function askLocal(history: Turn[]): Promise<{ text: string; ms: number; suggestions: string[] }> {
  const t0 = Date.now();
  const convo = history.slice(-10).map((t) => `${t.role === "user" ? "Käyttäjä" : "Sinä"}: ${t.text}`).join("\n\n");
  const prompt = `TILANNEKUVA\n${await context()}\n\nKESKUSTELU\n${convo}\n\nVastaa käyttäjän viimeiseen viestiin.`;
  const out = await new Promise<string>((resolve, reject) => {
    // Ilman työkaluja ja MCP:tä, väliaikaishakemistossa (ei projektin CLAUDE.md:tä), ei istuntohistoriaa.
    const p = spawn(CLAUDE, ["-p", "--tools", "", "--output-format", "json", "--no-session-persistence", "--strict-mcp-config",
      "--model", process.env.LIIGA_LOCAL_MODEL ?? "sonnet", "--append-system-prompt", SYSTEM], { cwd: os.tmpdir() });
    let o = "", e = "";
    p.stdout.on("data", (b) => { o += b; }); p.stderr.on("data", (b) => { e += b; });
    p.on("error", (err) => reject(new Error(`Paikallista Claudea ei löytynyt (${err.message}). Asenna Claude Code tai aseta CLAUDE_BIN.`)));
    p.on("close", (code) => (code === 0 ? resolve(o) : reject(new Error(e.trim().split("\n").pop() || `claude päättyi koodiin ${code}`))));
    p.stdin.end(prompt);
  });
  const j = JSON.parse(out) as { result?: string; is_error?: boolean };
  if (j.is_error || !j.result) throw new Error(j.result || "Paikallinen Claude ei vastannut.");
  // Jatkokysymykset viimeiseltä JATKO-riviltä, kuten Snowflaken agentin suggested_queries.
  const m = j.result.match(/\n?\s*JATKO:\s*(.+)\s*$/);
  const suggestions = m ? m[1].split("|").map((q) => q.trim()).filter(Boolean).slice(0, 3) : [];
  return { text: m ? j.result.slice(0, m.index).trimEnd() : j.result, ms: Date.now() - t0, suggestions };
}
