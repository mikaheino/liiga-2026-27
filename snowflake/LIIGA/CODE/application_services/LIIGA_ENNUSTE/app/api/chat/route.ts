// POST { history: [{role, text}] } -> { text, ms }. Viimeinen vuoro on käyttäjän kysymys.
import { NextResponse } from "next/server";
import { ask, type Turn } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 300;            // agentin oma budjetti on 300 s

export async function POST(req: Request) {
  const { history } = (await req.json()) as { history?: Turn[] };
  const ok = Array.isArray(history) && history.length > 0 && history.every((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string" && t.text.length < 4000);
  if (!ok || history[history.length - 1].role !== "user") return NextResponse.json({ error: "virheellinen pyyntö" }, { status: 400 });
  try {
    return NextResponse.json(await ask(history));
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message).split("\n")[0].slice(0, 300) }, { status: 502 });
  }
}
