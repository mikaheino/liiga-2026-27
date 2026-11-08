// Paikallinen "Kysy agentilta" (17.10.): koneella ajettaessa keskustelu käyttää
// paikallista Claude Codea (`claude -p`) eikä Snowflaken agenttia. Claude saa
// tiiviin tilannekuvan samasta datasta kuin sivut (DuckDB) ja 6.11. alkaen samat
// työkalut kuin Snowflaken agentti MCP:n kautta (scripts/local/liiga_mcp.py):
// liiga_skenaario, liiga_kokoonpanot ja liiga_tieto samoilla nimillä, kuvauksilla
// ja toteutuksilla. liiga_ennuste/liiga_kausi tulevat vaiheessa B (VQR); siihen
// asti niistä vastataan tilannekuvasta. Muita työkaluja ei ole: --tools "" +
// --allowedTools vain mcp__liiga__* (todennettu 6.11., docs/claude/skenaario.md).
import { spawn } from "node:child_process";
import { qwenChat, qwenScenario } from "@/lib/qwen";
import { runEngine } from "@/lib/scenarioEngine";
import { normalize, verdict } from "@/lib/scenarioRules";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Event, ToolInput, Turn } from "@/lib/agent";
import { TOOL } from "@/lib/agentTools";
import { CONTEXT_RULE, type PageRef, pageContext } from "@/lib/pageContext";
import { loadFixtures, loadHistory, loadLog, loadMeta, loadPosition, loadTeams } from "@/lib/data";
import { modelSaid, scoreboard } from "@/lib/fixtures";
import { seasonTable, teamPoints } from "@/lib/table";

// Claude Code asentuu ~/.local/bin:iin, joka ei aina ole palvelinprosessin PATHissa.
const REPO = process.env.LIIGA_REPO ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../../../..");
const MCP_TOOLS = ["liiga_skenaario", "liiga_kokoonpanot", "liiga_tieto"];
const MCP = JSON.stringify({ mcpServers: { liiga: { command: path.join(REPO, ".venv/bin/python"), args: [path.join(REPO, "scripts/local/liiga_mcp.py")] } } });
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
Käytä vain alla annettua tilannekuvaa ja työkaluja; älä keksi lukuja. Työkalut: liiga_skenaario (mitä jos, loukkaantumiset, mitä vaaditaan -- luvut tulevat vain siitä, älä laske itse), liiga_kokoonpanot (pelipäivän kokoonpanot ja 1X2), liiga_tieto (miten malli toimii, rajoitukset, lähteet). Jos kysytty asia ei ole tilannekuvassa eikä työkaluissa (esim. pelaajatilastot), sano se yhdellä lauseella.
Lyhyesti: vastaus yhdellä lauseella, tarvittaessa enintään 10 rivin taulukko, enintään kaksi lausetta tulkintaa. Prosentit yhdellä desimaalilla, desimaalipilkku.
"Mestaruus" tarkoittaa tässä runkosarjan voittoa: malli ei ennusta pudotuspelejä. Vyöhykkeet: 1-6 puolivälierät, 7-10 karsinta, 15-17 putoaa. Vertaa mallin osuvuutta siihen, että kotijoukkue voittaa aina.
Vedonlyönnistä: anna luvut, älä kehota pelaamaan.
Lopeta joukkueita koskeva vastaus rivillä "Lisää sovelluksessa: /joukkue/<Joukkue>" ja muut sopivalla sivulla (/sarjataulukko, /voittaja, /ottelut, /liike) -- paitsi jos linkki osoittaisi sivulle, jolla käyttäjä jo on (ks. NÄKYMÄ).
Kirjoita aivan viimeiseksi riviksi kolme lyhyttä jatkokysymystä, joita käyttäjä voisi kysyä seuraavaksi, muodossa "JATKO: kysymys 1 | kysymys 2 | kysymys 3".`;

// Striimattuna kuten Snowflaken agentti: stream-json + osittaiset viestit, joten
// teksti alkaa näkyä heti eikä vasta ~8 s päästä. JATKO-rivi ei näy (selain katkaisee
// tekstin sen kohdalta), ja se puretaan lopuksi jatkokysymyksiksi.
// Qwen 3B tarvitsee lyhyen ohjeen ja vain olennaiset rivit (8.11.2026: koko tilannekuva + Claude-ohje
// tuotti sekavaa tekstiä). Rivit, joissa mainitaan kysymyksen joukkue, sekä otsikkorivit.
const QWEN_SYSTEM = `Olet Liigan ennustesovelluksen avustaja. Vastaa suomeksi 2–4 lyhyellä lauseella vain alla olevan DATAn perusteella.
Käytä lukuja täsmälleen niin kuin ne ovat datassa. Jos vastaus ei löydy datasta, sano se lyhyesti. Ei taulukoita, ei listoja.
Sanasto: jatkoon = sijat 1-10 (1-6 suoraan puolivälieriin, 7-10 säälipudotuspeleihin), putoaa = sijat 15-17.`;
async function qwenPrompt(convo: string, view: string): Promise<string> {
  const teams = await loadTeams();
  const last = convo.split("\n\n").slice(-1)[0].toLowerCase();
  const named = teams.filter((t) => last.includes(t.toLowerCase().slice(0, Math.max(3, t.length - 2))));
  const lines = (await context()).split("\n");
  const keep = lines.filter((x, i) => i === 0 || /^[A-ZÄÖ ]{6,}/.test(x) || (named.length ? named.some((t) => x.includes(t)) : i < 22));
  return `DATA\n${keep.join("\n")}${view ? `\n\nNÄKYMÄ\n${view.slice(0, 1500)}` : ""}\n\nKYSYMYS\n${convo.split("\n\n").slice(-1)[0].replace(/^Käyttäjä: /, "")}`;
}

export async function askLocal(history: Turn[], emit: (e: Event) => void, page?: PageRef): Promise<void> {
  const t0 = Date.now();
  emit({ t: "status", text: "Mietitään…" });
  const convo = history.slice(-10).map((t) => `${t.role === "user" ? "Käyttäjä" : "Sinä"}: ${t.text}`).join("\n\n");
  // Sivun tilannekuva samalla tavalla kuin Snowflaken agentille (lib/pageContext.ts).
  const view = page ? await pageContext(page) : "";
  const prompt = `TILANNEKUVA\n${await context()}\n\n${view ? `NÄKYMÄ\n${CONTEXT_RULE}\n${view}\n\n` : ""}KESKUSTELU\n${convo}\n\nVastaa käyttäjän viimeiseen viestiin.`;
  const tools = new Set<string>();
  const inputs: ToolInput[] = [];
  // Qwen ensin (8.11.2026, käyttäjä: "ei tarvitse kuluttaa Clauden tokeneita applikaatiossa").
  // Claude vain, jos LIIGA_LOCAL_LLM=claude.
  if (process.env.LIIGA_LOCAL_LLM !== "claude") {
    emit({ t: "status", text: "Qwen miettii…" });
    // Luvut koodista (8.11.2026): kysymys -> Qwen-skenaario -> moottori -> johtopäätöslause.
    const question = convo.split("\n\n").slice(-1)[0].replace(/^Käyttäjä: /, "");
    const teams = await loadTeams();
    // Koko liigan kysymys ilman joukkuetta ("Kuka voittaa runkosarjan?", "Ketkä putoavat?"): suoraan ennusteesta.
    const lowq = question.toLowerCase();
    if (/(^|\s)(kuka|ketkä|mikä joukkue|mitkä joukkueet)(\s|\?|$)/.test(lowq) && !teams.some((t) => lowq.includes(t.toLowerCase().slice(0, Math.max(3, t.length - 2))))) {
      const pos = await loadPosition();
      const sum = (p: number[], a: number, b: number) => p.slice(a - 1, b).reduce((x, y) => x + y, 0);
      const [label, f] = /putoa|karsi|viimei|pohj/.test(lowq) ? ["putoamisuhka (sijat 15–17)", (p: number[]) => sum(p, 15, 17)]
        : /kuusik|top ?6|puolivä/.test(lowq) ? ["kärkikuusikkoon", (p: number[]) => sum(p, 1, 6)]
        : /jatkoon|pudotuspel|playoff/.test(lowq) ? ["jatkoon (sijat 1–10)", (p: number[]) => sum(p, 1, 10)]
        : ["runkosarjan voitto", (p: number[]) => p[0]];
      const top = [...pos].sort((a, b) => f(b.p) - f(a.p)).slice(0, 3).map((r) => `${r.team} ${(100 * f(r.p)).toFixed(1).replace(".", ",")} %`);
      emit({ t: "done", text: `Mallin mukaan ${label}: ${top.join(", ")}.`, ms: Date.now() - t0, suggestions: [], tools: ["ennuste"], inputs });
      return;
    }
    const qi = await qwenScenario(question, "", teams).catch(() => null);
    if (qi?.length && !qi.some((x) => x.stakes_team != null || x.injury != null)) {
      const res = await runEngine<{ teams?: Record<string, unknown>[]; scenario_canonical?: Record<string, unknown>[]; error?: string }>("json", normalize(qi)).catch(() => null);
      if (res && !res.error && res.scenario_canonical) {
        const v = verdict(res as never, res.scenario_canonical, teams);
        const what = res.scenario_canonical.map((i) => String(i.label ?? "")).filter(Boolean).slice(0, 4).join("; ");
        emit({ t: "done", text: `${v}${what && !qi.every((x) => x.goal != null) ? `\n\nOletin: ${what}.` : ""}`, ms: Date.now() - t0, suggestions: [], tools: ["qwen", "liiga_skenaario"], inputs });
        return;
      }
    }
    const q = await qwenChat(QWEN_SYSTEM, await qwenPrompt(convo, view), (d) => emit({ t: "delta", text: d })).catch((e) => { throw new Error(`Qwen: ${(e as Error).message}`); });
    if (q == null) throw new Error("Qwen-mallia ei ole ladattu (models/). Aseta LIIGA_LOCAL_LLM=claude käyttääksesi Claudea.");
    const mq = q.match(/\n?\s*JATKO:\s*(.+)\s*$/);
    emit({ t: "done", text: mq ? q.slice(0, mq.index).trimEnd() : q, ms: Date.now() - t0,
      suggestions: mq ? mq[1].split("|").map((x) => x.trim()).filter(Boolean).slice(0, 3) : [], tools: ["qwen"], inputs });
    return;
  }
  const result = await new Promise<string>((resolve, reject) => {
    // Vain liigan MCP-työkalut, väliaikaishakemistossa (ei projektin CLAUDE.md:tä), ei istuntohistoriaa.
    const p = spawn(CLAUDE, ["-p", "--tools", "", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--no-session-persistence", "--strict-mcp-config", "--mcp-config", MCP,
      "--allowedTools", MCP_TOOLS.map((t) => `mcp__liiga__${t}`).join(","),
      "--model", process.env.LIIGA_LOCAL_MODEL ?? "sonnet", "--append-system-prompt", SYSTEM], { cwd: os.tmpdir() });
    let buf = "", e = "", final: string | null = null;
    p.stdout.on("data", (b) => {
      buf += b;
      for (let i; (i = buf.indexOf("\n")) >= 0;) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let j: { type?: string; event?: { type?: string; delta?: { type?: string; text?: string } }; result?: string; is_error?: boolean;
          message?: { content?: { type?: string; name?: string; input?: Record<string, unknown> }[] } };
        try { j = JSON.parse(line); } catch { continue; }
        // Työkalukutsu: sama tilarivi ja Jälki-nimi kuin Snowflaken agentilla.
        const use = j.type === "assistant" ? j.message?.content?.find((c) => c.type === "tool_use") : undefined;
        if (use?.name) {
          const n = use.name.replace(/^mcp__liiga__/, "");
          tools.add(n); inputs.push({ name: n, input: use.input ?? {} });
          emit({ t: "status", text: TOOL[n] ?? "Haetaan tietoja" });
        }
        if (j.type === "stream_event" && j.event?.type === "content_block_delta" && j.event.delta?.type === "text_delta") emit({ t: "delta", text: j.event.delta.text ?? "" });
        else if (j.type === "result") { if (j.is_error || !j.result) return reject(new Error(j.result || "Paikallinen Claude ei vastannut.")); final = j.result; }
      }
    });
    p.stderr.on("data", (b) => { e += b; });
    p.on("error", (err) => reject(new Error(`Paikallista Claudea ei löytynyt (${err.message}). Asenna Claude Code tai aseta CLAUDE_BIN.`)));
    p.on("close", (code) => (final != null ? resolve(final) : reject(new Error(e.trim().split("\n").pop() || `claude päättyi koodiin ${code}`))));
    p.stdin.end(prompt);
  });
  // Jatkokysymykset viimeiseltä JATKO-riviltä, kuten Snowflaken agentin suggested_queries.
  const m = result.match(/\n?\s*JATKO:\s*(.+)\s*$/);
  const suggestions = m ? m[1].split("|").map((q) => q.trim()).filter(Boolean).slice(0, 3) : [];
  emit({ t: "done", text: m ? result.slice(0, m.index).trimEnd() : result, ms: Date.now() - t0, suggestions, tools: [...tools], inputs });
}
