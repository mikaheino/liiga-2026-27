// Uutiset ja uutishaastaja (27.10.; docs/uutismalli_suunnitelma.md). Ylen ja
// seurojen uutiset, OK-nappi poissaoloille, päivän haastajaennusteet ja
// vertailu lukittuun malliin. Data vain Pages-käännöksessä (news-data-haara).
import NewsList from "@/components/NewsList";
import Shell from "@/components/Shell";
import { abScore, fixtureKey, gameKey } from "@/lib/challenger";
import { loadChallenger, loadFixtures, loadNews, loadTeams } from "@/lib/data";
import { fi } from "@/lib/table";

export const dynamic = "force-dynamic";

const pct = (p: number) => `${fi(100 * p, 0)} %`;

export default async function Page() {
  const [news, ch, fixtures, teams] = await Promise.all([loadNews(), loadChallenger(), loadFixtures(), loadTeams()]);
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
      </section>
      <div className="label sub">Uutiset</div>
      <NewsList items={news.items} candidates={news.candidates} absences={news.absences} teams={teams} />
    </Shell>
  );
}
