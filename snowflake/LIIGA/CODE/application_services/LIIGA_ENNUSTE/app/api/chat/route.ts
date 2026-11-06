// POST { history: [{role, text}] } -> NDJSON-striimi: {t:"status"|"delta"|"done"|"error", ...}
// rivi kerrallaan. Viimeinen vuoro on käyttäjän kysymys. Striimi, koska agentti
// vastaa 20-35 s:ssa: tila näkyy ~2 s:ssa ja teksti sitä mukaa kuin se syntyy.
import { NextResponse } from "next/server";
import { ask, type Event, type PageRef, type Turn } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 300;            // agentin oma budjetti on 300 s

export async function POST(req: Request) {
  const { history, page } = (await req.json()) as { history?: Turn[]; page?: PageRef };
  const ok = Array.isArray(history) && history.length > 0 && history.every((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string" && t.text.length < 4000);
  if (!ok || history[history.length - 1].role !== "user") return NextResponse.json({ error: "virheellinen pyyntö" }, { status: 400 });
  // Sivu, jolla kysymys esitettiin. Selaimelta tuleva arvo: vain polku ja
  // kyselymerkkijono, pituus rajattu -- lib/pageContext.ts lukee siitä sivun ja
  // valinnat eikä luota siihen muuten.
  const view: PageRef | undefined =
    page && typeof page.path === "string" && page.path.startsWith("/") && page.path.length < 200 &&
    (page.query == null || (typeof page.query === "string" && page.query.length < 400))
      ? { path: page.path, query: page.query } : undefined;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const emit = (e: Event) => { try { ctl.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { /* selain sulki */ } };
      try { await ask(history, emit, view); }
      catch (e) { emit({ t: "error", text: String((e as Error).message).split("\n")[0].slice(0, 300) }); }
      finally { try { ctl.close(); } catch { /* jo suljettu */ } }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}
