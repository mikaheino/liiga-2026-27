// "Kuvaile skenaario omin sanoin" kertakutsuna (6.11.2026). Logiikka lib/scenarioDescribe.ts:ssä;
// etusivun hakukenttä käyttää live-striimiä (app/api/skenaario/rakenna).
// Käyttäjän lausetta ei tallenneta (ei KORTTI_VASTAUS-riviä): talteen jäävät vain
// selaimen sessioon kanoniset rivit.
//   POST { text } -> { answer, items: [{...kanoninen, label}], tools, error? }
import { NextResponse } from "next/server";
import { describe } from "@/lib/scenarioDescribe";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const NO_STORE = { "cache-control": "no-store" };

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (text.length < 3 || text.length > 300) return NextResponse.json({ error: "kuvaa skenaario 3–300 merkillä" }, { status: 400, headers: NO_STORE });
  try {
    const d = await describe(text);
    return NextResponse.json({ answer: d.answer, items: d.items, tools: d.tools, ...(d.error ? { error: d.error } : {}) },
      { status: d.status ?? 200, headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502, headers: NO_STORE });
  }
}
