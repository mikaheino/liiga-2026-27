// Skenaarion säätöjen valinnat (7.11.2026, käyttäjä: "parametrisointi olis parempi", "esim entä jos
// maalivahti vaihtuu", "hae uutisista ideat", "per peli"). Kaikki datasta:
//   goalies  joukkueen ykkösvahti (eniten aloituksia tällä kaudella) ja varavahti
//   news     tuoreet loukkaantumis- ja pelikieltouutiset (NEWS_SIGNALS, 30 pv), joita ei ole jo
//            kirjattu uutissivulla (poissaolo, paluu tai päättynyt: käsitelty)
//   GET ?teams=Lukko,HIFK -> { goalies: {joukkue: {starter, backup}}, news: {joukkue: [{player, kind}]} }
import { NextResponse } from "next/server";
import { loadPlayers } from "@/lib/data";
import { NT } from "@/lib/newsContext";
import { query } from "@/lib/snowflake";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const teams = (new URL(req.url).searchParams.get("teams") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const since = new Date(Date.parse(today) - 30 * 864e5).toISOString().slice(0, 10);
  const [{ goalies }, abs, sig] = await Promise.all([
    loadPlayers().catch(() => ({ goalies: [] as { name: string; team: string; starts: number }[] })),
    // Kaikki kirjatut (voimassa, palannut tai päättynyt): uutinen on jo käsitelty.
    query(`SELECT DISTINCT player FROM ${NT("news_absence_log")} WHERE player IS NOT NULL`).catch(() => []),
    query(`SELECT player, team, kind FROM ${NT("news_signals")} WHERE published >= '${since}' AND kind IN ('injury', 'suspension')`).catch(() => []),
  ]);
  const out: { goalies: Record<string, { starter: string; backup: string | null }>; news: Record<string, { player: string; kind: string }[]> } = { goalies: {}, news: {} };
  const out_abs = new Set(abs.map((a) => String(a.PLAYER)));
  for (const t of teams) {
    const g = goalies.filter((x) => x.team === t).sort((a, b) => b.starts - a.starts);
    if (g[0]) out.goalies[t] = { starter: g[0].name, backup: g[1]?.name ?? null };
    out.news[t] = sig.filter((r) => String(r.TEAM) === t && !out_abs.has(String(r.PLAYER)))
      .map((r) => ({ player: String(r.PLAYER), kind: String(r.KIND) })).filter((x, i, a) => a.findIndex((y) => y.player === x.player) === i);
  }
  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
