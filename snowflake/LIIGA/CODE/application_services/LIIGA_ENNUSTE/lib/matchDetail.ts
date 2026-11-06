// Ottelukortin sisältö (MatchCard.tsx) yhdestä paikasta: kierroskortti, ottelulista,
// joukkuesivun viimeiset/seuraavat ja "Suurimmat hutit" avaavat saman kortin
// (5.11.2026: "voisiko sama ominaisuus olla muuallakin kuin muutamassa tulevassa
// ottelussa"). Puhdas funktio ilman palvelinriippuvuuksia, joten se toimii sekä
// palvelimella (NextRound, joukkuesivu) että selaimessa (FixturesView).
import type { MatchDetail } from "@/components/MatchCard";
import type { Challenger, NewsItem } from "@/lib/data";
import { type Fixture, modelSaid, resultText } from "@/lib/fixtures";

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fi-FI", { ...o, timeZone: "Europe/Helsinki" });
const dayName = fmt({ weekday: "short", day: "numeric", month: "numeric" });
const clock = fmt({ hour: "2-digit", minute: "2-digit" });
const short = (ts: string) => `${Number(ts.slice(8, 10))}.${Number(ts.slice(5, 7))}.`;
const ymd = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });

// Joukkueen tulos ottelusta: V, JV (jatkoaika/vl-voitto), JH, H.
function outcome(f: Fixture, team: string): string {
  const won = (f.home === team) === (f.hg! > f.ag!);
  const extra = f.category === "overtime" || f.category === "shootout";
  return won ? (extra ? "JV" : "V") : (extra ? "JH" : "H");
}

// Valmiit kysymykset vain, kun datassa on niille syy (ideoinnin linja: agenttia ei
// pyydetä puhumaan ilman syytä, eikä vastaväitettä pyytämättä).
function gameChips(g: Fixture): string[] {
  if (g.ended) {
    const said = modelSaid(g);
    return said != null && said < 40 ? ["Miksi malli meni pieleen?"] : [];
  }
  const today = ymd(new Date(g.start_ts)) === ymd(new Date());
  return [
    g.pHome == null ? null : Math.abs(g.pHome - 0.5) < 0.06 ? "Mikä ratkaisee näin tasaisen ottelun?" : `Miksi ${g.pHome >= 0.5 ? g.home : g.away} on suosikki?`,
    today ? "Ketkä pelaavat tänään, ja muuttaako se ennustetta?" : null,
  ].filter((c): c is string => !!c);
}

export function matchDetail(g: Fixture, all: Fixture[], news: NewsItem[] = [], c?: Challenger): MatchDetail {
  const played = all.filter((f) => f.ended && f.hg != null && f.ag != null && f.start_ts < g.start_ts);
  const form = Object.fromEntries([g.home, g.away].map((t) => [t,
    played.filter((f) => f.home === t || f.away === t).slice(-5).map((f) => outcome(f, t))]));
  const h2h = played.filter((f) => [f.home, f.away].sort().join() === [g.home, g.away].sort().join())
    .map((f) => ({ date: short(f.start_ts), text: `${f.home} ${resultText(f)} ${f.away}` }));
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const nw = news.filter((n) => (n.published || n.fetched) >= since && n.team.split(",").some((t) => t === g.home || t === g.away))
    .slice(0, 4).map((n) => ({ team: n.team.split(",").find((t) => t === g.home || t === g.away) ?? g.home, title: n.title, url: n.url,
      date: short((n.published || n.fetched).slice(0, 10)) }));
  return {
    when: `${dayName.format(new Date(g.start_ts))} klo ${clock.format(new Date(g.start_ts))}`, home: g.home, away: g.away,
    pHome: g.pHome, pOt: g.pOt, form, h2h, news: nw,
    result: g.ended ? resultText(g) : null,
    // Haastaja vain, kun se poikkeaa virallisesta tai sillä on huomioita (maalivahdit, poissaolot).
    ch: c && !Number.isNaN(c.pHome) && (c.notes || g.pHome == null || Math.abs(c.pHome - g.pHome) >= 0.005) ? { pHome: c.pHome, notes: c.notes } : null,
    // Agentin kysymykset sidotaan otteluun (season:game_id; game_id ei ole yksilöllinen kausien yli).
    agent: g.season && g.gameId ? { key: `${g.season}:${g.gameId}`, chips: gameChips(g) } : null,
  };
}
