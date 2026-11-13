// Joukkueen kaikki pelaamattomat ottelut ja niiden merkitys (8.11.2026, käyttäjä: "pelejä saisi olla
// reilusti enemmän" + markkinaideat: Sportskeeda = valitse tulokset itse, Clinch = ottelun vaikutus).
// Merkitys = moottorin panokset: joukkueen avoimen tavoitteen todennäköisyys voitolla vs. tappiolla.
// Ei kielimallia.  GET ?team=Lukko -> { team, goal, games: [{ id, date, iso, home, away, pHome, win, loss }] }
import { NextResponse } from "next/server";
import { loadFixtures, loadTeams } from "@/lib/data";
import { runEngine } from "@/lib/scenarioEngine";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };
type Stake = { game_id: number; top: { goal: string; p_home_win: number; p_away_win: number } };

export async function GET(req: Request) {
  const team = new URL(req.url).searchParams.get("team") ?? "";
  // Joukkue tarkistetaan joukkuelistasta (13.11.2026): tuntematon tai puuttuva nimi = 400.
  if (!team || !(await loadTeams()).includes(team)) return NextResponse.json({ error: "tuntematon joukkue" }, { status: 400, headers: NO_STORE });
  // Ajan mukaan (start_ts on ISO-muotoinen, joten merkkijonovertailu riittää); tasatilanteessa id.
  const fx = (await loadFixtures()).filter((f) => !f.ended && (f.home === team || f.away === team))
    .sort((a, b) => a.start_ts.localeCompare(b.start_ts) || (a.gameId ?? 0) - (b.gameId ?? 0));
  if (!fx.length) return NextResponse.json({ team, goal: null, games: [] }, { headers: NO_STORE });
  const r = await runEngine<{ stakes?: Stake[] }>("json", [{ stakes: { team, top: 200 } }]).catch(() => ({ stakes: [] as Stake[] }));
  const by = new Map((r.stakes ?? []).map((s) => [Number(s.game_id), s]));
  const goal = r.stakes?.[0]?.top.goal ?? null;
  const games = fx.map((f) => {
    const s = by.get(Number(f.gameId));
    const home = f.home === team;
    const d = new Date(f.start_ts);
    return { id: f.gameId, iso: f.start_ts.slice(0, 10), home: f.home, away: f.away, pHome: f.pHome,
      date: d.toLocaleDateString("fi-FI", { day: "numeric", month: "numeric", timeZone: "Europe/Helsinki" }),
      win: s ? (home ? s.top.p_home_win : s.top.p_away_win) : null, loss: s ? (home ? s.top.p_away_win : s.top.p_home_win) : null };
  });
  return NextResponse.json({ team, goal, games }, { headers: NO_STORE });
}
