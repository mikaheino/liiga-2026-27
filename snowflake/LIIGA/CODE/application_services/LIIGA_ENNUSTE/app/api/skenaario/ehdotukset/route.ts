// Hakuehdotukset uutisista (7.11.2026, lib/newsSuggestions.ts).
//   GET -> { suggestions: [{ q, meta, kind }] }  (Snowflakessa tyhjä, kunnes uutisdata on siellä)
import { NextResponse } from "next/server";
import { loadPosition, loadTeams } from "@/lib/data";
import { suggestions } from "@/lib/newsSuggestions";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const [teams, pos] = await Promise.all([loadTeams(), loadPosition().catch(() => [])]);
  const dist = Object.fromEntries(pos.map((r) => [r.team, r.p]));
  const list = await suggestions(teams, today, dist).catch(() => []);
  return NextResponse.json({ suggestions: list }, { headers: { "cache-control": "no-store" } });
}
