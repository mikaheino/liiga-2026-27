// POST { history: [{role, text}] } -> NDJSON-striimi: {t:"status"|"delta"|"done"|"error", ...}
// rivi kerrallaan. Viimeinen vuoro on käyttäjän kysymys. Striimi, koska agentti
// vastaa 20-35 s:ssa: tila näkyy ~2 s:ssa ja teksti sitä mukaa kuin se syntyy.
import { NextResponse } from "next/server";
import { ask, type Event, type Turn } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 300;            // agentin oma budjetti on 300 s

export async function POST(req: Request) {
  const { history } = (await req.json()) as { history?: Turn[] };
  const ok = Array.isArray(history) && history.length > 0 && history.every((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string" && t.text.length < 4000);
  if (!ok || history[history.length - 1].role !== "user") return NextResponse.json({ error: "virheellinen pyyntö" }, { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const emit = (e: Event) => { try { ctl.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { /* selain sulki */ } };
      try { await ask(history, emit); }
      catch (e) { emit({ t: "error", text: String((e as Error).message).split("\n")[0].slice(0, 300) }); }
      finally { try { ctl.close(); } catch { /* jo suljettu */ } }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}
