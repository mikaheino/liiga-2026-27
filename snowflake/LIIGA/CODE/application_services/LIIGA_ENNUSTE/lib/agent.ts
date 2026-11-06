// Keskustelu agentin kanssa, striimattuna (17.10., "agentti on todella hidas").
//
// Agentti vastaa 20-35 s:ssa, mutta REST-rajapinnan striimi kertoo jo ~2 s:ssa mitä
// se tekee ja kirjoittaa vastausta ruudulle sitä mukaa kuin se syntyy. Siksi:
//   Snowflake: POST /api/v2/.../agents/LIIGA_ENNUSTAJA:run (stream: true, SSE).
//     App Runtimessa palvelun sessiotoken (OAuth), paikallisesti liiga_ci-avainparin
//     JWT. Jos striimi ei aukea, varalla SQL:n DATA_AGENT_RUN (koko vastaus kerralla).
//   Paikallisesti (DuckDB-tila): paikallinen Claude, ks. lib/localClaude.ts.
//
// Päätteetön nimi = oletusversio = PRODUCTION (agentilla ei ole live-versiota,
// CLAUDE.md). LIIGA_AGENT='...!DEV' kokeilee DEV-aliasta paikallisesti.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "smol-toml";
import { askLocal } from "@/lib/localClaude";
import { TOOL } from "@/lib/agentTools";
import { CONTEXT_RULE, type PageRef, pageContext } from "@/lib/pageContext";
import { DATA_MODE, query } from "@/lib/snowflake";

const AGENT = process.env.LIIGA_AGENT ?? "SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA";
const TOKEN = "/snowflake/session/token";
export type Turn = { role: "user" | "assistant"; text: string };
export type { PageRef } from "@/lib/pageContext";
// Selaimelle kulkevat tapahtumat (NDJSON): tila, tekstin pala, valmis vastaus.
// Työkalukutsun syöte (6.11.): "kuvaile skenaario" lukee agentin liiga_skenaario-kutsun
// skenaarion ja ratkaisee sen moottorilla siruiksi (app/api/skenaario/kuvaile).
export type ToolInput = { name: string; input: Record<string, unknown> };
export type Event =
  | { t: "status"; text: string }
  | { t: "delta"; text: string }
  | { t: "done"; text: string; ms: number; suggestions: string[]; tools?: string[]; sql?: string[]; inputs?: ToolInput[] }
  | { t: "error"; text: string };
type Emit = (e: Event) => void;

// Paikallisesti (DuckDB-tila) keskustelu käyttää paikallista Claudea, Snowflakessa agenttia.
export const AGENT_SOURCE = DATA_MODE === "duckdb" ? "local" : "snowflake";

const body = (history: Turn[], stream: boolean) => JSON.stringify({
  messages: history.slice(-12).map((t) => ({ role: t.role, content: [{ type: "text", text: t.text }] })),
  stream,
});

// --- Vastauksen sisältö tekstiksi --------------------------------------------
// Vastaus on osien lista: tekstiä, taulukoita ja jatkokysymyksiä. Aiemmin vain
// viimeinen tekstiosa näytettiin, jolloin alku ja agentin taulukko jäivät pois.
type Col = { name: string; type: string; scale?: number };
type Table = { title?: string; result_set?: { data?: (string | null)[][]; resultSetMetaData?: { rowType?: Col[] } } };
type Part = { type?: string; text?: string; table?: Table; suggested_queries?: { query?: string }[]; tool_use?: { name?: string; input?: Record<string, unknown> }; tool_result?: unknown };

// Yleisimmät sarakkeet suomeksi; muut näytetään sellaisinaan pienellä.
const FI: Record<string, string> = {
  TEAM: "joukkue", TABLE_RANK: "sija", PROJECTED_RANK: "ennustesija", PROJ_RANK: "ennustesija", RANK: "sija", GAMES_PLAYED: "ottelut", GAMES: "ottelut",
  POINTS: "pisteet", MEAN_POINTS: "pisteet", GOAL_DIFF: "maaliero", GOALS_FOR: "tehdyt", GOALS_AGAINST: "päästetyt", LAST5_POINTS: "5 viim. p",
  WINS: "voitot", LOSSES: "tappiot", P_TITLE: "runkosarjan voitto %", HOME_TEAM: "koti", AWAY_TEAM: "vieras", PLAYER: "pelaaja", PLAYER_NAME: "pelaaja",
  GOALS: "maalit", ASSISTS: "syötöt", START_TIME: "alkaa", GAME_DATE: "päivä",
};
const num = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 2 });
function cell(v: string | null, c: Col): string {
  if (v == null) return "–";
  if ((c.type === "fixed" || c.type === "real") && v !== "" && !Number.isNaN(Number(v))) return num.format(Number(Number(v).toPrecision(12)));
  return v.replace(/\|/g, "/");
}
export function tableMd(t: Table): string {
  const cols = t.result_set?.resultSetMetaData?.rowType ?? [];
  const rows = (t.result_set?.data ?? []).slice(0, 20);
  if (!cols.length || !rows.length) return "";
  const head = cols.map((c) => FI[c.name.toUpperCase()] ?? c.name.toLowerCase().replace(/_/g, " "));
  return [t.title ? `**${t.title}**\n` : "", `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${cols.map((c, i) => cell(r[i], c)).join(" | ")} |`)].join("\n");
}
// Agentin jälki (5.11., ottelukortin "konepelti"): käytetyt työkalut ja Cortex
// Analystin generoima SQL. Työkalun nimi on tool_use-osassa (kuten
// morning_brief.py:99); SQL:n paikka tool_resultissa ei ole dokumentoitu, joten
// se haetaan mistä tahansa "sql"-avaimesta -- puuttuessaan jälki on ilman SQL:ää.
function sqlIn(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => sqlIn(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
    if (k === "sql" && typeof x === "string" && x.trim()) out.push(x.trim()); else sqlIn(x, out);
  }
  return out;
}
function render(parts: Part[]): { text: string; suggestions: string[]; tools: string[]; sql: string[]; inputs: ToolInput[] } {
  const text = parts.map((p) => (p.type === "text" ? p.text ?? "" : p.type === "table" && p.table ? `\n\n${tableMd(p.table)}\n\n` : "")).join("").replace(/\n{3,}/g, "\n\n").trim();
  const suggestions = parts.flatMap((p) => p.suggested_queries ?? []).map((q) => q.query ?? "").filter(Boolean).slice(0, 3);
  const tools = [...new Set(parts.filter((p) => p.type === "tool_use").map((p) => p.tool_use?.name ?? "").filter(Boolean))];
  const sql = [...new Set(parts.filter((p) => p.type === "tool_result").flatMap((p) => sqlIn(p.tool_result)))];
  const inputs = parts.filter((p) => p.type === "tool_use" && p.tool_use?.name).map((p) => ({ name: p.tool_use!.name!, input: p.tool_use!.input ?? {} }));
  return { text, suggestions, tools, sql, inputs };
}

// --- Tilaviestit suomeksi ----------------------------------------------------
const STATUS: Record<string, string> = {
  planning: "Suunnitellaan", sandbox_provisioning: "Valmistellaan", sandbox_ready: "Valmistellaan",
  extracting_tool_calls: "Valitaan tietolähde", reasoning_agent_stop: "Tarkistetaan tulokset", reevaluating_plan: "Tarkistetaan tulokset",
  proceeding_to_answer: "Kirjoitetaan vastausta", "Executing SQL": "Ajetaan kysely", "Validating SQL": "Tarkistetaan kysely",
};

// --- REST-tunnistus ------------------------------------------------------------
function auth(): { base: string; headers: Record<string, string> } {
  if (fs.existsSync(TOKEN)) {
    return {
      base: `https://${process.env.SNOWFLAKE_HOST}`,
      headers: { Authorization: `Bearer ${fs.readFileSync(TOKEN, "utf8")}`, "X-Snowflake-Authorization-Token-Type": "OAUTH" },
    };
  }
  const name = process.env.LIIGA_SNOW_CONNECTION ?? "liiga_ci";
  const conn = (parse(fs.readFileSync(path.join(os.homedir(), ".snowflake", "connections.toml"), "utf8")) as Record<string, Record<string, string>>)[name];
  const key = crypto.createPrivateKey(fs.readFileSync((conn.private_key_file ?? conn.private_key_path).replace(/^~/, os.homedir()), "utf8"));
  const fp = "SHA256:" + crypto.createHash("sha256").update(crypto.createPublicKey(key).export({ type: "spki", format: "der" })).digest("base64");
  const acct = conn.account.toUpperCase(), user = conn.user.toUpperCase(), now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: `${acct}.${user}.${fp}`, sub: `${acct}.${user}`, iat: now, exp: now + 3000 })}`;
  const jwt = `${unsigned}.${crypto.sign("RSA-SHA256", Buffer.from(unsigned), key).toString("base64url")}`;
  return {
    base: `https://${conn.host ?? `${conn.account.toLowerCase().replace(/_/g, "-")}.snowflakecomputing.com`}`,
    headers: { Authorization: `Bearer ${jwt}`, "X-Snowflake-Authorization-Token-Type": "KEYPAIR_JWT", ...(conn.role ? { "X-Snowflake-Role": conn.role } : {}) },
  };
}

// --- Striimi -------------------------------------------------------------------
// Palauttaa false, jos striimi ei auennut (silloin kutsuja käyttää SQL-polkua).
async function streamRest(history: Turn[], emit: Emit, t0: number): Promise<boolean> {
  const [db, schema, name] = AGENT.split("!")[0].split(".");
  const { base, headers } = auth();
  const res = await fetch(`${base}/api/v2/databases/${db}/schemas/${schema}/agents/${name}:run`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json", Accept: "text/event-stream" }, body: body(history, true),
  });
  if (!res.ok || !res.body) {
    console.log(`[agent] striimi ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)} -> SQL`);
    return false;
  }
  const dec = new TextDecoder();
  let buf = "", last = "";
  const status = (s: string) => { if (s && s !== last) emit({ t: "status", text: (last = s) + "…" }); };
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    for (let i; (i = buf.indexOf("\n\n")) >= 0;) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      const kind = /^event: (.*)$/m.exec(ev)?.[1] ?? "";
      const raw = /^data: (.*)$/m.exec(ev)?.[1] ?? "";
      if (kind === "done") continue;
      let d: Record<string, unknown>;
      try { d = JSON.parse(raw); } catch { continue; }
      if (kind === "response.status" || kind === "response.tool_result.status") status(STATUS[String(d.status)] ?? "");
      else if (kind === "response.tool_use") status(TOOL[String(d.name)] ?? "Haetaan tietoja");
      else if (kind === "response.text.delta") emit({ t: "delta", text: String(d.text ?? "") });
      else if (kind === "response.table") emit({ t: "delta", text: `\n\n${tableMd(d as Table)}\n\n` });
      else if (kind === "error") { emit({ t: "error", text: String(d.message ?? "Agentti palautti virheen.") }); return true; }
      else if (kind === "response") {
        const { text, suggestions, tools, sql, inputs } = render((d.content ?? []) as Part[]);
        emit({ t: "done", text: text || "Agentti ei vastannut.", ms: Date.now() - t0, suggestions, tools, sql, inputs });
        return true;
      }
    }
  }
  emit({ t: "error", text: "Striimi katkesi ennen vastausta." });
  return true;
}

// Varapolku: sama agentti SQL-funktiona, koko vastaus kerralla.
async function viaSql(history: Turn[], emit: Emit, t0: number) {
  emit({ t: "status", text: "Agentti miettii…" });
  const rows = await query<{ R: string }>("SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?) AS R", [AGENT, body(history, false)]);
  const r = JSON.parse(rows[0]?.R ?? "{}") as { content?: Part[]; message?: string; error?: string };
  const { text, suggestions, tools, sql, inputs } = render(r.content ?? []);
  emit({ t: "done", text: text || r.message || r.error || "Agentti ei vastannut.", ms: Date.now() - t0, suggestions, tools, sql, inputs });
}

// Sivun tilannekuva (5.11.) liitetään VAIN viimeiseen käyttäjäviestiin: näin se
// on aina sen sivun tieto, jolla kysymys esitettiin, eikä vanhentunutta
// kontekstia kerry historiaan -- selain tallentaa vuorot ilman tätä lohkoa.
async function withPage(history: Turn[], page?: PageRef): Promise<Turn[]> {
  if (!page) return history;
  const ctx = await pageContext(page);
  if (!ctx) return history;
  const i = history.length - 1;
  const q = history[i];
  return [...history.slice(0, i), { ...q, text: `${CONTEXT_RULE}\n\nNÄKYMÄ\n${ctx}\n\nKYSYMYS\n${q.text}` }];
}

export async function ask(history: Turn[], emit: Emit, page?: PageRef): Promise<void> {
  const t0 = Date.now();
  if (AGENT_SOURCE === "local") return askLocal(history, emit, page);
  const msgs = await withPage(history, page);
  let opened = false;
  try { opened = await streamRest(msgs, (e) => { opened = true; emit(e); }, t0); }
  catch (e) {
    if (opened) throw e;                                  // kesken katkennut: ei toista vastausta
    console.log(`[agent] striimi ei auennut: ${(e as Error).message} -> SQL`);
  }
  if (!opened) await viaSql(msgs, emit, t0);
}

// --- Kertakutsu (ottelukortti, 5.11.) ------------------------------------------
// Kortin kysymys ei ole keskustelu: yksi kysymys, kohteen tilannekuva mukana,
// vastaus tallennetaan riviksi (lib/kortti.ts). Sama agentti ja sama striimi kuin
// keskustelussa; tila ja osittainen teksti välitetään edistymisen näyttämiseen.
export type Answer = { text: string; suggestions: string[]; tools: string[]; sql: string[]; inputs: ToolInput[]; ms: number; source: "snowflake" | "local" };
export async function askOnce(question: string, context: string,
  progress: (p: { status?: string; partial?: string }) => void = () => {}): Promise<Answer> {
  let partial = "", done: Answer | null = null, error = "";
  const text = `${context}\n\nKYSYMYS\n${question}`;
  await ask([{ role: "user", text }], (e) => {
    if (e.t === "status") progress({ status: e.text });
    else if (e.t === "delta") { partial += e.text; progress({ partial: partial.split(/\n?\s*JATKO:/)[0] }); }
    else if (e.t === "error") error = e.text;
    else if (e.t === "done") done = { text: e.text, suggestions: e.suggestions, tools: e.tools ?? [], sql: e.sql ?? [], inputs: e.inputs ?? [], ms: e.ms, source: AGENT_SOURCE };
  });
  if (!done) throw new Error(error || "Agentti ei vastannut.");
  return done;
}
