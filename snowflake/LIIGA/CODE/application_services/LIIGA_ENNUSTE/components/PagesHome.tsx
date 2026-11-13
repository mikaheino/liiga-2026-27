// Etusivu GitHub Pagesissa (13.11.2026). Sovelluksessa etusivu on skenaariohaku, jota
// Pagesissa ei ole (ei agenttia), joten sivulla oli pelkät osiolinkit. Tässä kolme
// asiaa, joita julkinen kävijä hakee ensimmäisenä, samasta datasta kuin osiot:
//   1. seuraavan kierroksen ottelut ja voittotodennäköisyydet (sama kortti kuin /ottelut)
//   2. ennustettu lopputaulukko: pisteet, kuuden joukkoon, runkosarjan voitto
//   3. miten malli on osunut tällä kaudella (sama laskenta kuin /ottelut-sivun otsikko)
import Link from "next/link";
import NextRound from "@/components/NextRound";
import { gameKey } from "@/lib/challenger";
import { loadChallenger, loadChallengerSeason, loadFixtures, loadNews, loadPosition, loadStakes } from "@/lib/data";
import { nextRound, scoreboard } from "@/lib/fixtures";
import { logo, PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT } from "@/lib/table";

const pct = (x: number) => (x >= 99.5 ? ">99" : x < 0.5 ? (x > 0 ? "<1" : "0") : String(Math.round(x)));

export default async function PagesHome() {
  const [all, pos, challenger, season, news, stakeList] = await Promise.all([
    loadFixtures(), loadPosition(), loadChallenger(), loadChallengerSeason(), loadNews(),
    loadStakes().catch(() => []),
  ]);
  // Sama haastajan valinta kuin /ottelut-sivulla: päivän ajo ohittaa kausiennusteen arvion.
  const chMap = new Map(season.games.map((g) => [gameKey(g.date, g.home, g.away),
    { date: g.date, home: g.home, away: g.away, base: NaN, pHome: g.pHome, pOt: NaN, notes: g.notes }]));
  for (const c of challenger) chMap.set(gameKey(c.date, c.home, c.away), c);
  const stakes = new Map(stakeList.map((s) => [s.game_id, s]));
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const sb = scoreboard(all);
  return (
    <>
      <div className="ot-today"><NextRound games={nextRound(all, today)} challenger={chMap} all={all} news={news.items} stakes={stakes} /></div>
      <section className="ph" aria-label="Ennustettu lopputaulukko">
        <div className="ph-head">
          <div className="label">Ennustettu lopputaulukko</div>
          <Link href="/sijainti">Kaikki sijoitukset ▸</Link>
        </div>
        <table className="ph-table">
          <thead><tr><th /><th>Joukkue</th><th className="num">Pisteet</th><th className="num">Top {PLAYOFF_CUT}</th><th className="num">Voitto</th></tr></thead>
          <tbody>
            {pos.map((r, i) => {
              const top = 100 * r.p.slice(0, PLAYOFF_CUT).reduce((a, b) => a + b, 0);
              const cut = [PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT].includes(i + 1) && i + 1 < pos.length;
              return (
                <tr key={r.team} className={cut ? "cut" : ""}>
                  <td className="num dim">{i + 1}</td>
                  <td>
                    <Link href={`/joukkue/${encodeURIComponent(r.team)}`} className="ph-team">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo(r.team)} alt="" width={20} height={20} />{r.team}
                    </Link>
                  </td>
                  <td className="num">{Math.round(r.points)}</td>
                  <td className="num">{pct(top)} %</td>
                  <td className="num">{pct(r.pTitle)} %</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="ph-note">Simuloitu loppukausi: odotetut pisteet ja todennäköisyys sijoittua kuuden joukkoon tai voittaa runkosarja.
          Viivat: suoraan puolivälieriin ({PLAYOFF_CUT}.), karsintaan ({QUALI_CUT}.), putoamisraja ({RELEGATION_CUT}.).</p>
      </section>
      {sb.n > 0 && (
        <section className="ph ph-score" aria-label="Mallin osuvuus">
          <div className="label">Mallin osuvuus tällä kaudella</div>
          <p><b>{sb.hits} / {sb.n}</b> ottelun voittaja oikein ({Math.round(100 * sb.hits / sb.n)} %).
            Vertailu: aina kotijoukkueen valitseva osuisi {Math.round(100 * sb.home / sb.n)} %.{" "}
            <Link href="/ottelut">Ottelu ottelulta ▸</Link></p>
        </section>
      )}
    </>
  );
}
