// Skenaario rakentuu livenä (7.11.2026, käyttäjä: "haluan että AI rakentaa livenä skenaarion,
// mutta hyödyntää SQL dataa ja koneoppimismalleja"). Sama ketju kuin /api/skenaario/kuvaile
// (lib/scenarioDescribe.ts), mutta jokainen vaihe striimataan selaimelle sitä mukaa kuin se
// tapahtuu: agentin työkalukutsut (datahaku SQL:llä, simulointi mallilla), yhteenvedon teksti,
// ajetut SQL-lauseet ja moottorin kanoniset rivit.
//   POST { text } -> NDJSON (text = kuvaus, tai tarkennuksessa kuvaus + agentin kysymys + vastaus):
//     {t:"step", text}        uusi vaihe (edellinen valmis)
//     {t:"text", text}        yhteenveto tähän asti (koko teksti, ei pala)
//     {t:"sql", sql: [...]}   agentin ajamat SQL-lauseet (Snowflake; paikallisesti tyhjä)
//     {t:"done", answer, items, tools, error?}
//     {t:"error", text}
import { describe } from "@/lib/scenarioDescribe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof b.text === "string" ? b.text.trim() : "";
  // 1500: tarkennuskierros lähettää alkuperäisen kuvauksen, agentin kysymyksen ja vastauksen.
  if (text.length < 3 || text.length > 1500) return Response.json({ error: "kuvaa skenaario 3–300 merkillä" }, { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const send = (o: object) => { try { ctl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* selain sulki */ } };
      let last = "";
      const step = (s: string) => { const t = s.replace(/…$/, ""); if (t && t !== last) send({ t: "step", text: (last = t) }); };
      try {
        step("Tulkitaan kuvaus");
        const d = await describe(text, (p) => {
          if (p.status) step(p.status);
          if (p.partial) send({ t: "text", text: p.partial });
        });
        if (d.sql.length) send({ t: "sql", sql: d.sql.slice(0, 5) });
        send({ t: "done", answer: d.answer, items: d.items, tools: d.tools, ...(d.error ? { error: d.error } : {}) });
      } catch (e) {
        send({ t: "error", text: String((e as Error).message).split("\n")[0].slice(0, 300) });
      } finally { try { ctl.close(); } catch { /* jo suljettu */ } }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}
