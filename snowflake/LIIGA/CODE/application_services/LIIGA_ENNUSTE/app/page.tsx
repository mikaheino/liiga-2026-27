// Etusivu: kauden tilanne, sijaintijakauma ja valikko. Kaikki muu on drilldownia:
// heatmapin rivi avaa joukkueen (/joukkue/Tappara), valikko osiot. Käyttäjä 16.10.:
// muut osiot eivät näy oletuksena, mutta demossa niihin hypätään täältä.
import Link from "next/link";
import { type Line } from "@/components/Heatmap";
import NextRound from "@/components/NextRound";
import ScenarioBoard from "@/components/ScenarioBoard";
import SeasonQuestions from "@/components/SeasonQuestions";
import PositionBoard from "@/components/PositionBoard";
import Season from "@/components/Season";
import TimeTravel from "@/components/TimeTravel";
import Top from "@/components/Top";
import { gameKey } from "@/lib/challenger";
import { loadChallenger, loadChallengerSeason, loadFixtures, loadNews, loadHistory, loadLine, loadLog, loadMeta, loadPosition, loadPositionHistory, loadSeasonQuestions, loadStakes, loadTeams } from "@/lib/data";
import { nextRound, scoreboard } from "@/lib/fixtures";
import { fi, seasonTable } from "@/lib/table";
import { STATIC } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ meta, next }, pos, log, teams, fixtures, { history, preseason }, sim, challenger, season, news, snapsAll, stakeList, questions] = await Promise.all([
    loadMeta(), loadPosition(), loadLog(), loadTeams(), loadFixtures(), loadHistory(), loadLine(), loadChallenger(), loadChallengerSeason(), loadNews(),
    loadPositionHistory().catch((e) => { console.log(`[data] jakaumahistoria: ${(e as Error).message}`); return []; }),
    // Panokset: puuttuva moottori (esim. proseduuri ei vielä julkaistu) ei kaada etusivua.
    loadStakes().catch((e) => { console.log(`[data] panokset: ${(e as Error).message}`); return []; }),
    loadSeasonQuestions().catch((e) => { console.log(`[data] kauden kysymykset: ${(e as Error).message}`); return []; }),
  ]);
  const stakes = new Map(stakeList.map((s) => [s.game_id, s]));
  // Kelattavat tilannekuvat: kaikki ennen nykyistä ennustetta (nykyhetki tulee suoraan).
  const nowDate = String(meta?.UPDATED_AT ?? "").slice(0, 10);
  const snaps = snapsAll.filter((s) => s.date < nowDate);
  // Haastaja kierroskorttiin: päivän ajo (maalivahdit + poissaolot) ohittaa kausiennusteen
  // otteluarvion (vain poissaolot), joka kattaa myös tulevat päivät.
  const chMap = new Map(season.games.map((g) => [gameKey(g.date, g.home, g.away),
    { date: g.date, home: g.home, away: g.away, base: NaN, pHome: g.pHome, pOt: NaN, notes: g.notes }]));
  for (const c of challenger) chMap.set(gameKey(c.date, c.home, c.away), c);
  // Jokaisessa ovessa elävä nosto -- ovi kertoo jo mitä sen takana on.
  const table = seasonTable(log, teams);
  const leader = table[0];
  // 14 parhaan raja: todennäköinen ja varma simulaatiosta, toteuma = 14. sijan pisteet nyt.
  const lineRank = sim?.rank ?? 14;
  const line: Line | null = sim ? { ...sim, now: table[lineRank - 1]?.pts ?? null } : null;
  const fav = [...pos].sort((a, b) => b.pTitle - a.pTitle)[0];
  const s = scoreboard(fixtures);
  const latest = history.length ? history[history.length - 1].date : "";
  const mover = history.filter((h) => h.date === latest && preseason.has(h.team))
    .map((h) => ({ team: h.team, d: h.points - preseason.get(h.team)! }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  const doors = [
    { href: "/sijainti", k: "Sijainnit", v: line ? `Raja ${line.likely} p` : "–",
      s: `${lineRank} parhaan raja · pistetahdit`, phone: true },
    { href: "/sarjataulukko", k: "Sarjataulukko", v: leader ? leader.team : "–", s: leader ? `${leader.pts} p kärjessä` : "" },
    { href: "/voittaja", k: "Runkosarjan voittaja", v: fav ? `${fav.team} ${fi(fav.pTitle, 0)} %` : "–", s: "suosikki nyt" },
    { href: "/ottelut", k: "Ottelut", v: s.n ? `${Math.round((100 * s.hits) / s.n)} % oikein` : "–", s: s.n ? `${s.hits}/${s.n} voittajaa` : "" },
    { href: "/liike", k: "Ennusteen liike", v: mover ? `${mover.team} ${mover.d > 0 ? "+" : ""}${fi(mover.d)}` : "–", s: "suurin muutos esikaudesta" },
    { href: "/linkedin", k: "LinkedIn", v: "7 postausta", s: "PDF:t jakoon" },
  ].filter((d) => !(STATIC && d.href === "/linkedin"));
  return (
    <div className="shell">
      <Top updatedAt={meta?.UPDATED_AT} active="/" />
      <main className="main front">
        {/* Seuraava kierros ylimpänä (käyttäjä 6.11.); kelattava yläpalkki ja heatmap
            peräkkäin, jotta palkin ja taulukon yhteys on ilmeinen. */}
        <NextRound games={nextRound(fixtures, new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" }))}
          challenger={chMap} all={fixtures} news={news.items} stakes={stakes} />
        <SeasonQuestions questions={questions} />
        {!STATIC && <ScenarioBoard />}
        <TimeTravel snaps={snaps}>
        {meta && <Season played={meta.GAMES_PLAYED} total={meta.GAMES_TOTAL} nextDate={next?.D ?? null} nextGames={Number(next?.N ?? 0)} />}
        {/* Sijaintitaulukko: tietokoneella etusivulla, puhelimessa omalla sivullaan (ovi alla). */}
        <div className="desk-only"><PositionBoard /></div>
        </TimeTravel>
        <nav className="doors" aria-label="Osiot">
          {doors.map((d, i) => (
            <Link key={d.href} href={d.href} className={`door ${"phone" in d && d.phone ? "phone-only" : ""}`} style={{ animationDelay: `${600 + i * 90}ms` }}>
              <span className="door-k">{d.k}</span>
              <span className="door-v">{d.v}</span>
              <span className="door-s">{d.s}</span>
              <span className="door-go" aria-hidden>▶</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
