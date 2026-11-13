// Etusivu GitHub Pagesissa (13.11.2026). Sovelluksessa etusivu on skenaariohaku, jota
// Pagesissa ei ole (ei agenttia), joten sivulla oli pelkät osiolinkit. Tässä kolme
// asiaa, joita julkinen kävijä hakee ensimmäisenä, samasta datasta kuin osiot:
//   0. päivän tilanne neljällä kortilla: kärki, suurin nousija ja laskija edellisestä
//      laskennasta, kierroksen tasaisin ottelu (lisätty samana päivänä: sivu alkoi taulukolla
//      eikä kertonut, mikä on muuttunut)
//   1. seuraavan kierroksen ottelut ja voittotodennäköisyydet (sama kortti kuin /ottelut)
//   2. ennustettu lopputaulukko: pisteet, kuuden joukkoon, runkosarjan voitto
//   3. miten malli on osunut tällä kaudella (sama laskenta kuin /ottelut-sivun otsikko)
import Link from "next/link";
import NextRound from "@/components/NextRound";
import { gameKey } from "@/lib/challenger";
import { loadChallenger, loadChallengerSeason, loadFixtures, loadHistory, loadNews, loadPosition, loadStakes } from "@/lib/data";
import { nextRound, scoreboard } from "@/lib/fixtures";
import { fi, logo, PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT } from "@/lib/table";

const pct = (x: number) => (x >= 99.5 ? ">99" : x < 0.5 ? (x > 0 ? "<1" : "0") : String(Math.round(x)));

export default async function PagesHome() {
  const [all, pos, challenger, season, news, stakeList, { history }] = await Promise.all([
    loadFixtures(), loadPosition(), loadChallenger(), loadChallengerSeason(), loadNews(),
    loadStakes().catch(() => []), loadHistory(),
  ]);
  // Sama haastajan valinta kuin /ottelut-sivulla: päivän ajo ohittaa kausiennusteen arvion.
  const chMap = new Map(season.games.map((g) => [gameKey(g.date, g.home, g.away),
    { date: g.date, home: g.home, away: g.away, base: NaN, pHome: g.pHome, pOt: NaN, notes: g.notes }]));
  for (const c of challenger) chMap.set(gameKey(c.date, c.home, c.away), c);
  const stakes = new Map(stakeList.map((s) => [s.game_id, s]));
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const sb = scoreboard(all);
  const round = nextRound(all, today);
  // Liike: uusin ennuste vastaan viimeisin aiempi ennustepäivä, josta jokin on muuttunut.
  // Pelkkä "eilinen" olisi tyhjä aina, kun eilen ei pelattu (13.11.: ei otteluita 12.11.).
  const dates = [...new Set(history.map((h) => h.date))].sort();
  const at = (d: string) => new Map(history.filter((h) => h.date === d).map((h) => [h.team, h.points]));
  const last = dates[dates.length - 1], now = last ? at(last) : new Map<string, number>();
  const diff = (d: string) => { const b = at(d); return [...now].map(([team, p]) => ({ team, d: p - (b.get(team) ?? p) })).sort((x, y) => y.d - x.d); };
  const since = dates.slice(0, -1).reverse().slice(0, 14).find((d) => diff(d).some((m) => Math.abs(m.d) > 0.05));
  const moves = since ? diff(since) : [];
  const sinceText = since ? `odotetut pisteet ${Number(since.slice(8))}.${Number(since.slice(5, 7))}. jälkeen` : "";
  const up = moves[0], down = moves[moves.length - 1];
  const tight = round.filter((g) => g.pHome != null).sort((a, b) => Math.abs(a.pHome! - 0.5) - Math.abs(b.pHome! - 0.5))[0];
  const lead = pos[0];
  const isToday = round[0]?.start_ts && new Date(round[0].start_ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" }) === today;
  const signed = (x: number) => `${x > 0 ? "+" : ""}${fi(x)} p`;
  return (
    <>
    <header className="ph-lead">
      <h1>{round.length ? `${isToday ? "Tänään" : "Seuraavaksi"} ${round.length} ${round.length === 1 ? "ottelu" : "ottelua"}` : "Runkosarjan ennuste"}</h1>
      <p>Jokainen jäljellä oleva ottelu arvioitu ja loppukausi simuloitu 10 000 kertaa. <Link href="/tietoa">Miten ennuste lasketaan ▸</Link></p>
    </header>
    <section className="kpis ph-kpis" aria-label="Tilanne nyt">
      {lead && <Tile k="Ennusteen kärki" team={lead.team} big={lead.team} sub={`${Math.round(lead.points)} p · runkosarjan voitto ${pct(lead.pTitle)} %`} tone="gold" />}
      {up && up.d > 0.05 && <Tile k="Suurin nousija" team={up.team} big={`${up.team} ${signed(up.d)}`} sub={sinceText} />}
      {down && down.d < -0.05 && <Tile k="Suurin laskija" team={down.team} big={`${down.team} ${signed(down.d)}`} sub={sinceText} tone="danger" />}
      {tight && <Tile k="Tasaisin ottelu" big={`${tight.home} – ${tight.away}`} sub={`${Math.round(100 * tight.pHome!)} – ${Math.round(100 * (1 - tight.pHome!))} %`} tone="cold" />}
    </section>
    <div className="ph-grid">
      <div className="ph-col ot-today"><NextRound games={round} challenger={chMap} all={all} news={news.items} stakes={stakes} /></div>
      <div className="ph-col">
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
      </div>
    </div>
    </>
  );
}

function Tile({ k, team, big, sub, tone = "" }: { k: string; team?: string; big: string; sub: string; tone?: string }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-k">{k}</div>
      <div className="kpi-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {team && <img src={logo(team)} alt="" width={30} height={30} />}
        <div><div className="kpi-big">{big}</div><div className="kpi-sub">{sub}</div></div>
      </div>
    </div>
  );
}
