// Keskustelu agentin kanssa: SNOWFLAKE.CORTEX.DATA_AGENT_RUN samalla yhteydellä
// kuin muu data -- toimii paikallisesti (liiga_ci) ja App Runtimessa
// (palvelun sessiotoken) ilman erillistä REST-kirjautumista.
//
// Päätteetön nimi = oletusversio = PRODUCTION (agentilla ei ole live-versiota,
// CLAUDE.md). LIIGA_AGENT='...!DEV' kokeilee DEV-aliasta paikallisesti.
import { askLocal } from "@/lib/localClaude";
import { DATA_MODE, query } from "@/lib/snowflake";

const AGENT = process.env.LIIGA_AGENT ?? "SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA";
export type Turn = { role: "user" | "assistant"; text: string };

type Part = { type?: string; text?: string; suggested_queries?: { query?: string }[] };
export type Answer = { text: string; ms: number; suggestions?: string[] };
// Paikallisesti (DuckDB-tila) keskustelu käyttää paikallista Claudea, Snowflakessa agenttia.
export const AGENT_SOURCE = DATA_MODE === "duckdb" ? "local" : "snowflake";
export async function ask(history: Turn[]): Promise<Answer> {
  if (AGENT_SOURCE === "local") return askLocal(history);
  const body = JSON.stringify({
    messages: history.slice(-12).map((t) => ({ role: t.role, content: [{ type: "text", text: t.text }] })),
    stream: false,
  });
  const t0 = Date.now();
  const rows = await query<{ R: string }>("SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?) AS R", [AGENT, body]);
  const r = JSON.parse(rows[0]?.R ?? "{}") as { content?: Part[]; message?: string; error?: string };
  const texts = (r.content ?? []).filter((p) => p.type === "text" && p.text).map((p) => p.text!);
  const text = texts.length ? texts[texts.length - 1] : r.message ?? r.error ?? "Agentti ei vastannut.";
  // Jatkokysymykset, kuten CoWork näyttää: agentti palauttaa ne omana osanaan.
  const suggestions = (r.content ?? []).flatMap((p) => p.suggested_queries ?? []).map((q) => q.query ?? "").filter(Boolean).slice(0, 3);
  return { text, ms: Date.now() - t0, suggestions };
}
