// Etusivu (uusittu 6.11.2026, kolmas iteraatio; 7.11. päivän tarina ja ratkaisupeli ylimmäksi,
// käyttäjä: "tylsä"). Kerrokset lukujärjestyksessä, kukin yhdellä otsikolla:
//   0. Päivän tarina + ratkaisupeli  viikon suurin nousu (lib/dayStory.ts), suurimman panoksen ottelu
//   1. Seuraava kierros   ennuste, panos ja lukitus (ottelukortti)
//   2. Kauden kysymykset   luku, viikon muutos ja kausikäyrä (V7)
//   3. Oma skenaario       "entä jos": kuvaile omin sanoin tai lukitse korteista (vain sovellus)
//   4. Kausi               kelattava palkki + sijaintijakauma kaikilla leveyksillä
// Osioiden ovet korvattu yhdellä linkkirivillä puhelimelle (tietokoneella yläpalkki).
// Agentti elää kohteissa (ottelukortti, joukkue, skenaario), ei omana osionaan.
import Link from "next/link";
import { DayStory, KeyGame } from "@/components/DayStory";
import NextRound from "@/components/NextRound";
import PositionBoard from "@/components/PositionBoard";
import ScenarioBoard from "@/components/ScenarioBoard";
import Season from "@/components/Season";
import SeasonQuestions from "@/components/SeasonQuestions";
import TimeTravel from "@/components/TimeTravel";
import Top, { SECTIONS } from "@/components/Top";
import { gameKey } from "@/lib/challenger";
import { loadChallenger, loadChallengerSeason, loadFixtures, loadMeta, loadNews, loadPosition, loadPositionHistory, loadSeasonQuestions, loadStakes } from "@/lib/data";
import { dayStory } from "@/lib/dayStory";
import { nextRound } from "@/lib/fixtures";
import { STATIC } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ meta, next }, pos, fixtures, challenger, season, news, snapsAll, stakeList, questions] = await Promise.all([
    loadMeta(), loadPosition(), loadFixtures(), loadChallenger(), loadChallengerSeason(), loadNews(),
    loadPositionHistory().catch((e) => { console.log(`[data] jakaumahistoria: ${(e as Error).message}`); return []; }),
    // Panokset ja kysymykset: puuttuva moottori (proseduuri ei vielä julkaistu) ei kaada etusivua.
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
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const round = nextRound(fixtures, today);
  const story = nowDate ? dayStory(snapsAll, pos, nowDate) : null;
  const links = [["/sijainti", "Sijainnit"], ...SECTIONS.filter(([h]) => h !== "/ottelut")] as const;

  return (
    <div className="shell">
      <Top updatedAt={meta?.UPDATED_AT} active="/" />
      <main className="main front fr">
        <DayStory story={story} />
        <KeyGame games={round} stakes={stakes} all={fixtures} news={news.items} challenger={chMap} />
        <NextRound games={round} challenger={chMap} all={fixtures} news={news.items} stakes={stakes} />
        <SeasonQuestions questions={questions} />
        {!STATIC && <ScenarioBoard />}
        <section className="fr-season" aria-label="Kausi">
          <div className="label">Kausi</div>
          <TimeTravel snaps={snaps}>
            {meta && <Season compact played={meta.GAMES_PLAYED} total={meta.GAMES_TOTAL} nextDate={next?.D ?? null} nextGames={Number(next?.N ?? 0)} />}
            <PositionBoard />
          </TimeTravel>
        </section>
        <nav className="fr-links phone-only" aria-label="Osiot">
          {links.map(([href, label]) => href.startsWith("http")
            ? <a key={href} href={href}>{label}</a>
            : <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </main>
    </div>
  );
}
