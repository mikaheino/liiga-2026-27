// Hakuehdotukset (7.11.2026): uutisista (lib/newsSuggestions.ts) ja datasta (lib/dataSuggestions.ts),
// lomitettuina ja sekoitettuina joka latauksella (käyttäjä: "Lisää vaihtelua, 10x").
//   GET -> { suggestions: [{ q, meta, kind }] }  (Snowflakessa uutisosa tyhjä, kunnes uutisdata on siellä)
import { NextResponse } from "next/server";
import { loadFixtures, loadMeta, loadPosition, loadTeams } from "@/lib/data";
import { dataSuggestions } from "@/lib/dataSuggestions";
import { suggestions } from "@/lib/newsSuggestions";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const seed = Math.floor(Math.random() * 1_000_000);
  const [teams, pos, fixtures, { meta }] = await Promise.all([loadTeams(), loadPosition().catch(() => []), loadFixtures().catch(() => []), loadMeta()]);
  const dist = Object.fromEntries(pos.map((r) => [r.team, r.p]));
  const iso = String(meta?.UPDATED_AT ?? today).slice(0, 10);
  const stamp = `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
  const [news, data] = await Promise.all([
    suggestions(teams, today, dist, seed).catch((e) => { console.log(`[ehdotukset] uutiset: ${(e as Error).message}`); return []; }),
    Promise.resolve(dataSuggestions(pos, fixtures, today, stamp, seed)),
  ]);
  // Lomitus: uutinen, data, uutinen, data … ettei lista ole yhtä tyyppiä.
  const out = [];
  for (let i = 0; i < Math.max(news.length, data.length); i++) { if (news[i]) out.push(news[i]); if (data[i]) out.push(data[i]); }
  return NextResponse.json({ suggestions: out }, { headers: { "cache-control": "no-store" } });
}
