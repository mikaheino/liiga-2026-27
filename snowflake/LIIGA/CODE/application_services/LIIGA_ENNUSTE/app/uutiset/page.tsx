// Uutiset ja uutishaastaja (27.10.; docs/uutismalli_suunnitelma.md). Ylen ja
// seurojen uutiset, OK-nappi poissaoloille, päivän haastajaennusteet ja
// vertailu lukittuun malliin. Data vain Pages-käännöksessä (news-data-haara).
import NewsList from "@/components/NewsList";
import Shell from "@/components/Shell";
import { abScore, fixtureKey, gameKey } from "@/lib/challenger";
import { loadChallenger, loadChallengerSeason, loadFixtures, loadNews, loadTeams } from "@/lib/data";
import { fi } from "@/lib/table";

export const dynamic = "force-dynamic";

const pct = (p: number) => `${fi(100 * p, 0)} %`;

export default async function Page() {
  const [news, ch, fixtures, teams, season] = await Promise.all([loadNews(), loadChallenger(), loadFixtures(), loadTeams(), loadChallengerSeason()]);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  // Viimeisin kirjaus pelaajaa kohden (paluu korvaa poissaolon).
  const latest = new Map(news.absences.map((a) => [a.player, a]));
  const active = [...latest.values()].filter((a) => a.kind === "out" && a.until > today);
  const moved = season.teams.filter((t) => Math.abs(t.points - t.pointsNow) >= 0.3).sort((a, b) => a.points - a.pointsNow - (b.points - b.pointsNow));
  const ab = abScore(ch, fixtures);
  const ended = new Set(fixtures.filter((f) => f.ended).map(fixtureKey));
  const upcoming = ch.filter((c) => !ended.has(gameKey(c.date, c.home, c.away)));
  const d = ab.llNews - ab.llBase;
  return (
    <Shell active="/uutiset" title="Uutiset ja haastaja">
      <section className="ab">
        <div className="label">Haastaja vs. lukittu malli</div>
        {ab.n === 0 ? (
          <p className="dim">Haastaja kirjaa ennusteensa joka päivä klo 14 (aloittavat maalivahdit, pelikiellot ja hyväksytyt poissaolot). Vertailu alkaa, kun ensimmäiset niistä on pelattu.</p>
        ) : (
          <div className="ab-grid">
            <div><span className="ab-k">Otteluita</span><b>{ab.n}</b><small>{ab.changed} muuttui</small></div>
            <div><span className="ab-k">Log-loss</span><b>{fi(ab.llBase, 3)} → {fi(ab.llNews, 3)}</b>
              <small className={d < 0 ? "up" : d > 0 ? "down" : ""}>{d === 0 ? "sama" : `${d < 0 ? "parempi" : "huonompi"} ${fi(Math.abs(d), 4)}`}</small></div>
            <div><span className="ab-k">Voittaja oikein</span><b>{ab.hitsBase} → {ab.hitsNews}</b><small>/ {ab.n}</small></div>
          </div>
        )}
        {ab.rows.length > 0 && (
          <div className="ab-today">
            <div className="label sub">Pelatut</div>
            {/* Uusin ensin; kotivoiton todennäköisyys lukittu -> haastaja, ja kumpi osui lähemmäs. */}
            {[...ab.rows].reverse().slice(0, 12).map((r) => {
              const g = r.llBase - r.llNews;
              return (
                <div key={r.date + r.home} className="ab-row">
                  <span className="ab-game">{Number(r.date.slice(8, 10))}.{Number(r.date.slice(5, 7))}. {r.home} – {r.away} {r.hg}–{r.ag}</span>
                  <span className="ab-p">{pct(r.base)} → <b>{pct(r.pHome)}</b>{" "}
                    <small className={g > 0.0005 ? "up" : g < -0.0005 ? "down" : ""}>{g > 0.0005 ? "haastaja lähempänä" : g < -0.0005 ? "lukittu lähempänä" : "sama"}</small></span>
                  {r.notes && <span className="ab-notes">{r.notes}</span>}
                </div>
              );
            })}
          </div>
        )}
        {upcoming.length > 0 && (
          <div className="ab-today">
            <div className="label sub">Haastajan ennusteet</div>
            {upcoming.map((c) => (
              <div key={c.date + c.home} className="ab-row">
                <span className="ab-game">{c.home} – {c.away}</span>
                <span className="ab-p">{pct(c.base)} → <b>{pct(c.pHome)}</b></span>
                {c.notes && <span className="ab-notes">{c.notes}</span>}
              </div>
            ))}
          </div>
        )}
        <div className="label sub">Haastajan kausiennuste</div>
        {active.length === 0 ? <p className="dim">Ei voimassa olevia poissaoloja: kausiennuste on sama kuin virallinen.</p> : (<>
          {moved.map((t) => (
            <div key={t.team} className="chs-row">
              <span className="ab-game">{t.team}</span>
              <b>{fi(t.pointsNow)} → {fi(t.points)} p</b>
              <span>top 6 {pct(t.topNow)} → {pct(t.top)}</span>
            </div>
          ))}
          <p className="chs-abs">Poissa: {active.map((a) => `${a.player} (${a.team}, ${a.games === "kausi" ? "loppukausi" : a.games.replace(/(ott|vko|kk)$/, " $1")}, palaa ${Number(a.until.slice(8, 10))}.${Number(a.until.slice(5, 7))}.)`).join(" · ")}</p>
        </>)}
      </section>
      <div className="label sub">Uutiset</div>
      <NewsList items={news.items} candidates={news.candidates} absences={news.absences} teams={teams} roster={news.roster} effects={news.effects} events={news.events}
        builtAt={new Date().toLocaleString("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })} />
    </Shell>
  );
}
