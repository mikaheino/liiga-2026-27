// Skenaario rakentuu livenä (7.11.2026, käyttäjä: "haluan että AI rakentaa livenä skenaarion,
// mutta hyödyntää SQL dataa ja koneoppimismalleja"). Sama ketju kuin /api/skenaario/kuvaile
// (lib/scenarioDescribe.ts), mutta jokainen vaihe striimataan selaimelle sitä mukaa kuin se
// tapahtuu: agentin työkalukutsut (datahaku SQL:llä, simulointi mallilla), yhteenvedon teksti,
// ajetut SQL-lauseet, moottorin kanoniset rivit ja moottorin luvut. Valmis haku tallennetaan
// (lib/skenaarioHaut.ts; käyttäjä: "Haluan että skenaariot tallentuvat ja niiden vastaukset").
//   POST { text, prompt?, followup?, base? } -> NDJSON (base = nykyinen skenaario: [{item, label}],
//                               jonka päälle rakennetaan; rivit tarkistetaan kuten /api/skenaario)
//                               (followup = vastaus agentin tarkentavaan kysymykseen;
//                               text on silloin alkuperäinen haku ja prompt koko ketju):
//     {t:"step", text}        uusi vaihe (edellinen valmis)
//     {t:"text", text}        yhteenveto tähän asti (koko teksti, ei pala)
//     {t:"sql", sql: [...]}   agentin ajamat SQL-lauseet (Snowflake; paikallisesti tyhjä)
//     {t:"done", id, answer, items, result (sis. charts), chart (agentin valinta), tools, error?}
//     {t:"error", text}
import { AGENT_SOURCE } from "@/lib/agent";
import { forecastStamp } from "@/lib/kortti";
import { loadTeams } from "@/lib/data";
import { describe, splitChart } from "@/lib/scenarioDescribe";
import { runEngine } from "@/lib/scenarioEngine";
import { MAX_ITEMS, validItem } from "@/lib/scenarioItems";
import { saveHaku, summarize } from "@/lib/skenaarioHaut";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const SEASON = 2027;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { text?: unknown; prompt?: unknown; followup?: unknown; base?: unknown };
  const text = typeof b.text === "string" ? b.text.trim() : "";
  const followup = typeof b.followup === "string" && b.followup.trim() ? b.followup.trim().slice(0, 300) : null;
  // 1500: tarkennuskierros lähettää alkuperäisen kuvauksen, agentin kysymyksen ja vastauksen.
  const prompt = typeof b.prompt === "string" && b.prompt.trim() ? b.prompt.trim() : text;
  if (text.length < 3 || text.length > 300 || prompt.length > 1500) return Response.json({ error: "kuvaa skenaario 3–300 merkillä" }, { status: 400 });
  // Pohjaskenaario: vain moottorin kanonisia rivejä; label on näyttöteksti (rajattu, ei ohjeita).
  const raw = Array.isArray(b.base) ? (b.base as { item?: unknown; label?: unknown }[]) : [];
  const teams = new Set(await loadTeams());
  if (raw.length > MAX_ITEMS || !raw.every((x) => x && validItem(x.item, teams))) return Response.json({ error: "virheellinen pohjaskenaario" }, { status: 400 });
  const base = raw.length ? { items: raw.map((x) => x.item as Record<string, unknown>),
    labels: raw.map((x) => String(x.label ?? "").replace(/[\r\n]/g, " ").slice(0, 120)) } : null;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const send = (o: object) => { try { ctl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* selain sulki */ } };
      let last = "";
      const step = (s: string) => { const t = s.replace(/…$/, ""); if (t && t !== last) send({ t: "step", text: (last = t) }); };
      const t0 = Date.now();
      const forecastTs = await forecastStamp().catch(() => "");
      const save = (h: Parameters<typeof saveHaku>[0]) => saveHaku(h).catch((e) => { console.log(`[skenaario] tallennus: ${(e as Error).message}`); return null; });
      try {
        step("Tulkitaan kuvaus");
        const d = await describe(prompt, (p) => {
          if (p.status) step(p.status);
          if (p.partial) send({ t: "text", text: splitChart(p.partial).text });
        }, base);
        if (d.sql.length) send({ t: "sql", sql: d.sql.slice(0, 5) });
        // Vaikutukset lasketaan tässä eikä selaimessa, jotta luvut tallentuvat haun mukana.
        let result: Record<string, unknown> | null = null;
        if (d.items.length && !d.error) {
          step("Lasketaan vaikutukset: 10 000 simuloitua kautta (malli: pelaajat 40 % · Elo 60 %)");
          result = await runEngine("json", d.items.map(({ label: _l, ...x }) => x));
          if (result?.error) { d.error = String(result.error); result = null; }
        }
        const status = d.error ? "error" : d.items.length ? "done" : "clarify";
        const id = await save({ season: SEASON, question: text, followup, answer: d.error ? `${d.answer}\n\n${d.error}`.trim() : d.answer,
          items: d.items, result: result ? { ...summarize(result, d.chart), news: d.news ?? [] } : null, tools: d.tools, sql: d.sql, forecastTs, ms: Date.now() - t0, status, source: AGENT_SOURCE });
        send({ t: "done", id, answer: d.answer, items: d.items, result, chart: d.chart ?? null, news: d.news ?? [], tools: d.tools, ...(d.error ? { error: d.error } : {}) });
      } catch (e) {
        const msg = String((e as Error).message).split("\n")[0].slice(0, 300);
        await save({ season: SEASON, question: text, followup, answer: msg, items: [], result: null, tools: [], sql: [], forecastTs, ms: Date.now() - t0, status: "error", source: AGENT_SOURCE });
        send({ t: "error", text: msg });
      } finally { try { ctl.close(); } catch { /* jo suljettu */ } }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}
