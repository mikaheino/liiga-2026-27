// Kohteeseen sidottu kysymys (5.11.2026; agentti-ideoinnin 11 kierroksen suositus).
//
// Agentilta ei kysytä erillisessä ikkunassa vaan siitä kohteesta, jota katsotaan:
// ottelukortissa (kaikki ottelut) ja joukkuesivulla. Vastaus EI ole keskustelun
// vuoro vaan datarivi:
//   kohde       (subject_type, subject_key): ('game', '2027:2701477'), ('team', '2027:Tappara').
//               Kausi on avaimessa, koska game_id ei ole yksilöllinen kausien yli.
//               ('player', '2027:32675788'), ('season', '2027:liiga') -- koko liigan
//               pelaajakysymykset, joilla ei ole yhtä pelaajaa kohteena (/pelaajat).
//               Uusi kohdetyyppi = uusi haara resolve()-funktioon, ei skeemamuutos.
//   perusta     forecast_ts = ennusteen aikaleima kysymyshetkellä (PREDICTION_META)
//   elinkaari   pending -> done | error; kun ennuste päivittyy, rivi on "VANHA PERUSTA"
//   jälki       työkalut, SQL, kesto, agentti -- avautuu kortista samalla eleellä
// Rivi jää kohteelle: illan kysymyksen vastaus on siellä seuraavana aamuna.
//
// Tallennus: Snowflakessa LIIGA.MODEL.KORTTI_VASTAUS (luodaan deploy-app.yml:ssä
// tiedostosta snowflake/LIIGA/MODEL/tables/KORTTI_VASTAUS.sql julkaisuroolilla, joka
// omistaa myös sovelluspalvelun). Paikallisesti (DuckDB-tila) JSON-tiedosto
// ~/.cache/liiga-ennuste/kortti.json -- gitissä oleva data/liiga.duckdb ei muutu.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Goalie, type Skater, loadFixtures, loadMeta, loadPlayers, loadPosition, loadTeams } from "@/lib/data";
import { type Fixture, resultText } from "@/lib/fixtures";
import { team as teamLines } from "@/lib/pageContext";
import { DATA_MODE, query } from "@/lib/snowflake";

export type SubjectType = "game" | "team" | "player" | "season";
export type Row = {
  id: string; subjectType: SubjectType; subjectKey: string; season: number; question: string;
  answer: string | null; suggestions: string[]; tools: string[]; sql: string[];
  forecastTs: string; askedAt: string; answeredAt: string | null; ms: number | null;
  status: "pending" | "done" | "error"; source: string;
};
export type Progress = { status?: string; partial?: string };

const TABLE = "LIIGA.MODEL.KORTTI_VASTAUS";
const STALE_PENDING_MS = 5 * 60_000;     // palvelin käynnistyi uudelleen kesken -> keskeytynyt
const LOCAL = path.join(os.homedir(), ".cache", "liiga-ennuste", "kortti.json");

// Kesken olevien kutsujen tila muistissa: App Runtimessa on yksi instanssi
// (app.yml max_instances 1), joten sama prosessi ajaa kutsun ja vastaa kyselyihin.
const live: Map<string, Progress> = ((globalThis as { __liigaKortti?: Map<string, Progress> }).__liigaKortti ??= new Map());
export const progressOf = (id: string) => live.get(id);
export const setProgress = (id: string, p: Progress) => live.set(id, { ...live.get(id), ...p });
export const clearProgress = (id: string) => live.delete(id);

export const normalize = (q: string) => q.trim().replace(/\s+/g, " ").replace(/[?!.]+$/, "").toLowerCase();

// --- Tallennus ---------------------------------------------------------------------

const arr = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) { try { const j = JSON.parse(v); return Array.isArray(j) ? j.map(String) : []; } catch { return []; } }
  return [];
};
// Paikallisen tiedoston vanhat rivit (ennen yleistystä: season + gameId) muunnetaan lennossa.
function readLocal(): Row[] {
  try {
    return (JSON.parse(fs.readFileSync(LOCAL, "utf8")) as (Row & { gameId?: number })[]).map(({ gameId, ...r }) =>
      r.subjectType ? r : { ...r, subjectType: "game" as const, subjectKey: `${r.season}:${gameId}` });
  } catch { return []; }
}
function writeLocal(rows: Row[]) { fs.mkdirSync(path.dirname(LOCAL), { recursive: true }); fs.writeFileSync(LOCAL, JSON.stringify(rows, null, 1)); }

function finish(r: Row): Row {
  // Palvelimen uudelleenkäynnistys katkaisee kesken olevan kutsun; rivi ei saa jäädä
  // ikuisesti "kesken"-tilaan.
  if (r.status === "pending" && !live.has(r.id) && Date.now() - Date.parse(r.askedAt) > STALE_PENDING_MS) {
    return { ...r, status: "error", answer: "Kutsu keskeytyi (palvelin käynnistyi uudelleen). Kysy uudestaan." };
  }
  return r;
}

export async function listRows(type: SubjectType, key: string): Promise<Row[]> {
  if (DATA_MODE === "duckdb") return readLocal().filter((r) => r.subjectType === type && r.subjectKey === key).map(finish);
  const rows = await query(`
    SELECT id, subject_type, subject_key, season, question, answer, suggestions, tools, sql_text, forecast_ts,
           TO_VARCHAR(asked_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS asked_at,
           TO_VARCHAR(answered_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS answered_at, ms, status, source
    FROM ${TABLE} WHERE subject_type = ? AND subject_key = ? ORDER BY asked_at`, [type, key]);
  return rows.map((r) => finish({
    id: String(r.ID), subjectType: String(r.SUBJECT_TYPE) as SubjectType, subjectKey: String(r.SUBJECT_KEY), season: Number(r.SEASON),
    question: String(r.QUESTION), answer: r.ANSWER == null ? null : String(r.ANSWER),
    suggestions: arr(r.SUGGESTIONS), tools: arr(r.TOOLS), sql: arr(r.SQL_TEXT),
    forecastTs: String(r.FORECAST_TS ?? ""), askedAt: String(r.ASKED_AT), answeredAt: r.ANSWERED_AT == null ? null : String(r.ANSWERED_AT),
    ms: r.MS == null ? null : Number(r.MS), status: String(r.STATUS) as Row["status"], source: String(r.SOURCE ?? ""),
  }));
}

export async function insertPending(s: Subject, question: string, forecastTs: string, source: string): Promise<Row> {
  const row: Row = { id: crypto.randomUUID(), subjectType: s.type, subjectKey: s.key, season: s.season, question, answer: null,
    suggestions: [], tools: [], sql: [], forecastTs, askedAt: new Date().toISOString(), answeredAt: null, ms: null, status: "pending", source };
  if (DATA_MODE === "duckdb") { writeLocal([...readLocal(), row]); return row; }
  await query(`INSERT INTO ${TABLE} (id, subject_type, subject_key, season, question, forecast_ts, status, source)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`, [row.id, s.type, s.key, s.season, question, forecastTs, source]);
  return row;
}

export async function completeRow(id: string, f: { status: "done" | "error"; answer: string; suggestions?: string[]; tools?: string[]; sql?: string[]; ms: number }) {
  if (DATA_MODE === "duckdb") {
    writeLocal(readLocal().map((r) => (r.id === id ? { ...r, ...f, suggestions: f.suggestions ?? [], tools: f.tools ?? [], sql: f.sql ?? [], answeredAt: new Date().toISOString() } : r)));
    return;
  }
  await query(`
    UPDATE ${TABLE} SET status = ?, answer = ?, suggestions = PARSE_JSON(?), tools = PARSE_JSON(?), sql_text = PARSE_JSON(?),
           ms = ?, answered_at = CURRENT_TIMESTAMP()
    WHERE id = ?`,
  [f.status, f.answer, JSON.stringify(f.suggestions ?? []), JSON.stringify(f.tools ?? []), JSON.stringify(f.sql ?? []), f.ms, id]);
}

// --- Kohteet ja niiden tilannekuva -------------------------------------------------

export async function forecastStamp(): Promise<string> {
  const { meta } = await loadMeta();
  return String(meta?.UPDATED_AT ?? "");
}

const pct = (p: number) => `${Math.round(100 * p)} %`;
const day = (ts: string) => new Intl.DateTimeFormat("fi-FI", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }).format(new Date(ts));

// Sama sisältö kuin ottelukortissa (lib/matchDetail.ts), tekstinä agentille. Vire ja
// keskinäiset ottelua edeltävistä otteluista, jotta pelatun ottelun kuva ei vuoda.
function gameContext(g: Fixture, all: Fixture[], forecastTs: string): string {
  const played = all.filter((f) => f.ended && f.hg != null && f.ag != null && f.start_ts < g.start_ts);
  const form = (t: string) => played.filter((f) => f.home === t || f.away === t).slice(-5)
    .map((f) => `${f.home}–${f.away} ${resultText(f)}`).join("; ") || "ei otteluita";
  const h2h = played.filter((f) => [f.home, f.away].sort().join() === [g.home, g.away].sort().join())
    .map((f) => `${f.start_ts.slice(0, 10)} ${f.home}–${f.away} ${resultText(f)}`).join("; ");
  return [
    `Ottelu: ${g.home}–${g.away} (koti ${g.home}), ${day(g.start_ts)}${g.ended ? `, PELATTU, lopputulos ${resultText(g)}` : ""}.`,
    g.pHome != null ? `Mallin ennuste${g.ended ? " ennen ottelua" : ""}: ${g.home} ${pct(g.pHome)}, ${g.away} ${pct(1 - g.pHome)} (jatkoajat mukana)${g.pOt != null ? `, jatkoajan todennäköisyys ${pct(g.pOt)}` : ""}.` : "Mallin ennustetta ei ole tälle ottelulle.",
    `Ennusteen aikaleima nyt: ${forecastTs}.`,
    `${g.home}, viimeiset 5 ennen ottelua: ${form(g.home)}.`,
    `${g.away}, viimeiset 5 ennen ottelua: ${form(g.away)}.`,
    h2h ? `Keskinäiset tällä kaudella ennen ottelua: ${h2h}.` : "Ei aiempia keskinäisiä otteluita tällä kaudella.",
  ].join("\n");
}

// Ohje agentille. Analyytikon sävy (käyttäjän päätös 16.10.) tulee agentin omista
// ohjeista; tämä kertoo vain, missä kysymys esitettiin ja mihin vastaus päätyy.
const RULE = (where: string) =>
  `Käyttäjä kysyy sovelluksen ${where}, ja vastauksesi tallennetaan sinne riviksi, jonka hän lukee usein vasta myöhemmin. ` +
  "Kohteen tiedot ovat alla; ne ovat samasta mallista kuin sivu, joten älä hae niitä uudelleen työkalulla -- hae vain se, mitä alla ei ole " +
  "(esim. pelaajat, kokoonpanot, vahvuudet, mallin toiminta, mitä vaaditaan). Älä keksi todennäköisyyksiä: uusi luku tulee vain työkalusta. " +
  "Vastaa lyhyesti: 1-3 virkettä, tarvittaessa pieni taulukko. Älä viittaa 'tähän hetkeen' -- kirjoita niin, että vastaus on ymmärrettävä huomennakin. " +
  "Sovelluslinkkiä ei tarvita, koska käyttäjä on jo kohteen sivulla.";

export type Subject = { type: SubjectType; key: string; season: number; context: string };

const f1 = (x: number | null) => (x == null ? "–" : x.toFixed(1).replace(".", ","));
const sg = (x: number | null) => (x == null ? "–" : `${x >= 0 ? "+" : "−"}${f1(Math.abs(x))}`);
const skaterLine = (p: Skater) =>
  `${p.name} (${p.team}, ${p.position.toLowerCase()}): ${p.gp} ott, ${p.goals}+${p.assists}=${p.points} p` +
  `${p.prePpg != null ? `, esikauden odotus ${f1(p.prePpg)} p/ott, ero odotukseen ${sg(p.vsPre)} p` : ""}`;
const goalieLine = (g: Goalie) =>
  `${g.name} (${g.team}, maalivahti): ${g.gp} ott, ${g.starts} aloitusta, päästetyt/ott ${f1(g.gaa)}, ` +
  `torjunnat vs. keskivertomaalivahti ${sg(g.savedAvg)} maalia${g.savedPre != null ? `, vs. oma esikauden ennuste ${sg(g.savedPre)}` : ""}`;

// Pelaaja: oma rivi, joukkueen kolme parasta pistemiestä ja joukkueen ennuste
// (loukkaantumisskenaarioon agentti tarvitsee tiedon, kuinka keskeinen pelaaja on).
async function playerContext(id: number): Promise<{ text: string } | null> {
  const [{ skaters, goalies }, pos] = await Promise.all([loadPlayers(), loadPosition()]);
  const sk = skaters.find((p) => p.id === id), gk = goalies.find((g) => g.id === id);
  if (!sk && !gk) return null;
  const team = (sk ?? gk)!.team;
  const r = pos.find((x) => x.team === team);
  const mates = skaters.filter((p) => p.team === team).slice(0, 3).map(skaterLine);
  const keepers = goalies.filter((g) => g.team === team).map(goalieLine);
  return { text: [
    `PELAAJA (player_id ${id}): ${sk ? skaterLine(sk) : goalieLine(gk!)}.`,
    r ? `Joukkue ${team}: ennuste ${r.projRank}. sija, ${Math.round(r.points)} p, runkosarjan voitto ${f1(r.pTitle)} %.` : "",
    `Joukkueen parhaat pistemiehet: ${mates.join("; ")}.`,
    keepers.length ? `Joukkueen maalivahdit: ${keepers.join("; ")}.` : "",
  ].filter(Boolean).join("\n") };
}

// Koko liiga: sama kuin /pelaajat-sivulla (pistepörssin kärki, suurimmat erot
// esikauden odotukseen, maalivahdit). Kaikki muu agentti hakee työkaluillaan.
async function seasonContext(): Promise<string> {
  const { skaters, goalies } = await loadPlayers();
  const withPre = skaters.filter((p) => p.vsPre != null);
  const over = [...withPre].sort((a, b) => b.vsPre! - a.vsPre!).slice(0, 5);
  const under = [...withPre].sort((a, b) => a.vsPre! - b.vsPre!).slice(0, 5);
  const gks = goalies.filter((g) => g.savedAvg != null);
  return [
    `Pistepörssin kärki: ${skaters.slice(0, 10).map(skaterLine).join("; ")}.`,
    `Eniten yli esikauden odotuksen: ${over.map(skaterLine).join("; ")}.`,
    `Eniten alle esikauden odotuksen: ${under.map(skaterLine).join("; ")}.`,
    `Maalivahdit, paras torjuntaero: ${gks.slice(0, 5).map(goalieLine).join("; ")}.`,
    `Maalivahdit, heikoin torjuntaero: ${gks.slice(-3).map(goalieLine).join("; ")}.`,
    `Kenttäpelaajia ${skaters.length}, maalivahteja ${goalies.length}.`,
  ].join("\n");
}

// Kohde avaimesta. Selaimelta tuleva avain tarkistetaan datasta: vain olemassa
// oleva ottelu tai tämän kauden joukkue kelpaa.
export async function resolve(type: string, key: string, forecastTs: string): Promise<Subject | null> {
  const m = /^(\d{4}):(.{1,60})$/.exec(key);
  if (!m) return null;
  const season = Number(m[1]), rest = m[2];
  const all = await loadFixtures();
  if (type === "game" && /^\d+$/.test(rest)) {
    const g = all.find((f) => f.season === season && f.gameId === Number(rest));
    return g ? { type, key, season, context: `${RULE("OTTELUKORTISTA")}\n\nOTTELUKORTTI\n${gameContext(g, all, forecastTs)}` } : null;
  }
  if (type === "player" && /^\d+$/.test(rest)) {
    const current = Math.max(...all.map((f) => f.season ?? 0));
    const c = season === current ? await playerContext(Number(rest)) : null;
    return c ? { type, key, season, context: `${RULE("PELAAJAKORTISTA")}\n\n${c.text}\nEnnusteen aikaleima nyt: ${forecastTs}.` } : null;
  }
  if (type === "season" && rest === "liiga") {
    const current = Math.max(...all.map((f) => f.season ?? 0));
    if (season !== current) return null;
    return { type, key, season, context: `${RULE("PELAAJASIVULTA (koko liiga)")}\n\nPELAAJAT, KOKO LIIGA\n${await seasonContext()}\nEnnusteen aikaleima nyt: ${forecastTs}.` };
  }
  if (type === "team") {
    const current = Math.max(...all.map((f) => f.season ?? 0));
    if (season !== current || !(await loadTeams()).includes(rest)) return null;
    const lines = (await teamLines(rest)).filter(Boolean);
    return { type, key, season, context: `${RULE("JOUKKUESIVULTA")}\n\nJOUKKUESIVU: ${rest}\n${lines.join("\n")}\nEnnusteen aikaleima nyt: ${forecastTs}.` };
  }
  return null;
}
