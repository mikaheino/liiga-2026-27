// Ennakoiva vihje avustajalle (7.11.2026, käyttäjä: "muuta kysy agentilta 1-1 clippyksi" ja "AI:n
// pitäisi olla vielä ennustavampi"). Avustaja ei odota kysymystä: se kertoo sivulla datasta poimitun
// havainnon ja ehdottaa kysymystä, jota käyttäjä todennäköisimmin kysyisi seuraavaksi. Havainto ja
// luvut lasketaan koodilla (ennuste, viikon muutos, otteluohjelma), ei kielimallilla; kysymykseen
// vastaa agentti, kun käyttäjä napauttaa.
//   GET ?path=/joukkue/Tappara -> { text, q, more: [2 muuta kysymystä] } | { text: null }
// Muut kysymykset (7.11.: "muitakin kysymyksiä") samoista pohjista kuin hakuehdotukset (uutiset + data);
// joukkuesivulla vain sitä joukkuetta koskevat.
import { NextResponse } from "next/server";
import { loadFixtures, loadMeta, loadPosition, loadPositionHistory } from "@/lib/data";
import { dayStory } from "@/lib/dayStory";
import { dataSuggestions } from "@/lib/dataSuggestions";
import { suggestions } from "@/lib/newsSuggestions";
import { goalP, type QGoal } from "@/lib/seasonQuestions";
import { loadTeams } from "@/lib/data";

export const dynamic = "force-dynamic";
const pc = (x: number) => `${Math.round(100 * x)} %`;
const LABEL: Record<QGoal, string> = { top6: "kärkikuusikon", top10: "jatkopaikan", win: "runkosarjan voiton", relegation: "putoamisuhan" };
const QUESTION = (t: string, g: QGoal) => ({
  top6: `Mitä ${t} vaatii päästäkseen kärkikuusikkoon?`, top10: `Pääseekö ${t} jatkoon?`,
  win: `Voittaako ${t} runkosarjan?`, relegation: `Välttyykö ${t} putoamiselta?`,
}[g]);

// Joukkueelle auki oleva tavoite: se, jonka todennäköisyys on lähimpänä 50 %:a.
function openGoal(p: number[]): QGoal {
  return (["win", "top6", "top10", "relegation"] as QGoal[]).sort((a, b) => Math.abs(goalP(p, a) - 0.5) - Math.abs(goalP(p, b) - 0.5))[0];
}

export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path") ?? "/";
  const tip = await primary(path);
  if (!tip.text) return NextResponse.json(tip);
  try {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
    const seed = Math.floor(Math.random() * 1_000_000);
    const [teams, pos, fixtures, { meta }] = await Promise.all([loadTeams(), loadPosition(), loadFixtures().catch(() => []), loadMeta()]);
    const dist = Object.fromEntries(pos.map((r) => [r.team, r.p]));
    const iso = String(meta?.UPDATED_AT ?? today).slice(0, 10);
    const pool = [...(await suggestions(teams, today, dist, seed).catch(() => [])), ...dataSuggestions(pos, fixtures, today, `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`, seed)];
    const team = path.startsWith("/joukkue/") ? decodeURIComponent(path.split("/")[2] ?? "") : "";
    const more = pool.map((x) => x.q).filter((q) => q !== tip.q && (!team || q.includes(team)));
    return NextResponse.json({ ...tip, more: [...new Set(more)].slice(0, 2) });
  } catch {
    return NextResponse.json(tip);
  }
}

async function primary(path: string): Promise<{ text: string | null; q?: string }> {
  try {
    const [{ meta }, pos, snaps, fixtures] = await Promise.all([loadMeta(), loadPosition(), loadPositionHistory().catch(() => []), loadFixtures().catch(() => [])]);
    const today = String(meta?.UPDATED_AT ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.parse(today) - 7 * 864e5).toISOString().slice(0, 10);
    const ref = [...snaps].reverse().find((s) => s.date <= weekAgo);

    // Joukkuesivu: joukkueen auki oleva tavoite ja sen viikon muutos.
    if (path.startsWith("/joukkue/")) {
      const team = decodeURIComponent(path.split("/")[2] ?? "");
      const r = pos.find((x) => x.team === team);
      if (r) {
        const g = openGoal(r.p), now = goalP(r.p, g), was = ref?.p[team] ? goalP(ref.p[team], g) : null;
        const move = was == null ? "" : Math.abs(now - was) < 0.01 ? " ja on pysynyt viikon ennallaan" : ` (viikko sitten ${pc(was)})`;
        return ({ text: `${team}: ${LABEL[g]} todennäköisyys on nyt ${pc(now)}${move}.`, q: QUESTION(team, g) });
      }
    }
    // Ottelut: lähipäivien tiukin ottelu ennusteen sijoissa.
    if (path.startsWith("/ottelut")) {
      const rank = new Map(pos.map((x) => [x.team, x.projRank]));
      const g = fixtures.filter((f) => !f.ended).slice(0, 20)
        .sort((a, b) => Math.abs((rank.get(a.home) ?? 0) - (rank.get(a.away) ?? 0)) - Math.abs((rank.get(b.home) ?? 0) - (rank.get(b.away) ?? 0)))[0];
      if (g && g.pHome != null) {
        const d = new Date(g.start_ts).toLocaleDateString("fi-FI", { day: "numeric", month: "numeric", timeZone: "Europe/Helsinki" });
        return ({ text: `Tasaisin lähiajan ottelu: ${g.home}–${g.away} ${d}, malli antaa kotijoukkueelle ${pc(g.pHome)}.`,
          q: `Mitä jos ${g.away} voittaa ${g.home}–${g.away} ${d}?` });
      }
    }
    // Muut sivut: viikon suurin nousu (sama kuin entinen päivän tarina).
    const s = dayStory(snaps, pos, today);
    if (s) {
      return ({ text: `${s.team}: ${s.metric} ${pc(s.from)} → ${pc(s.to)} viikossa.`, q: QUESTION(s.team, s.goal) });
    }
    return { text: null };
  } catch {
    return { text: null };
  }
}
