// Tietoa: miten ennuste lasketaan ja miten se on osunut (13.11.2026). Luvut samasta
// laskennasta kuin /ottelut (lib/fixtures.ts), joten sivut eivät voi olla eri mieltä.
import Link from "next/link";
import Shell from "@/components/Shell";
import { loadFixtures } from "@/lib/data";
import { recentHits, ROUND, scoreboard } from "@/lib/fixtures";

export const dynamic = "force-dynamic";
export const metadata = { title: "Miten ennuste lasketaan" };

const pc = (a: number, b: number) => (b ? `${Math.round(100 * a / b)} %` : "–");

export default async function Page() {
  const all = await loadFixtures();
  const sb = scoreboard(all);
  const recent = recentHits(all, 4 * ROUND);
  return (
    <Shell active="/tietoa" title="Tietoa" rail={false}>
      <article className="about">
        <h1>Miten ennuste lasketaan</h1>
        <p className="about-lead">Liiga Ennuste arvioi jokaisen jäljellä olevan runkosarjaottelun ja simuloi loppukauden
          10 000 kertaa. Tuloksena on jokaiselle joukkueelle odotetut pisteet ja todennäköisyys jokaiseen sijoitukseen.</p>

        <section>
          <h2>Kaksi mallia, yksi ennuste</h2>
          <div className="about-cols">
            <div><b>Pelaajat · 40 %</b><p>Joukkueen hyökkäys ja puolustus arvioidaan sen pelaajista ja maalivahdeista:
              kuka on kokoonpanossa ja mitä he ovat aiemmin tehneet. Tästä saadaan ottelun maaliodotukset.</p></div>
            <div><b>Elo · 60 %</b><p>Joukkueen vire päivittyy jokaisen ottelun jälkeen tuloksen ja maalieron mukaan.
              Tämä osa oppii kauden aikana sen, mitä kokoonpano ei kerro.</p></div>
          </div>
          <p>Ottelun todennäköisyys on näiden painotettu yhdistelmä. Jo pelatut ottelut ovat mukana sellaisinaan:
            ennuste on kerätyt pisteet plus simuloitu loppukausi.</p>
        </section>

        <section>
          <h2>Miten malli on osunut</h2>
          {sb.n > 0 ? (
            <div className="about-stats">
              <div><b>{pc(sb.hits, sb.n)}</b><span>voittaja oikein, {sb.hits} / {sb.n} ottelua</span></div>
              <div><b>{pc(sb.home, sb.n)}</b><span>vertailu: aina kotijoukkue</span></div>
              {recent.n > 0 && <div><b>{pc(recent.hits, recent.n)}</b><span>viimeiset {recent.n} ottelua</span></div>}
            </div>
          ) : <p>Kauden ensimmäisiä otteluita ei ole vielä pelattu.</p>}
          <p>Jääkiekossa yksittäinen ottelu on lähellä kolikonheittoa: selvänkin suosikin voittotodennäköisyys on tyypillisesti 60–70 %.
            Siksi malli arvioidaan todennäköisyyksien osuvuudella pitkällä aikavälillä, ei yksittäisillä illoilla.
            Jokainen ottelu ja mallin sille antama arvio on <Link href="/ottelut">Ottelut-sivulla</Link>.</p>
        </section>

        <section>
          <h2>Lukittu malli ja haastaja</h2>
          <p>Mallia ei viritetä kesken kauden: se lukittiin ennen ensimmäistä ottelua, jotta sen osuvuutta voi mitata rehellisesti.
            Rinnalla kulkee haastaja, joka ottaa huomioon päivän kokoonpanon: poissaolot, pelikiellot ja aloittavan maalivahdin.
            Haastajan arvio näkyy ottelukortissa, ja kauden lopussa nähdään, kumpi osui paremmin.</p>
        </section>

        <section>
          <h2>Data ja päivitys</h2>
          <p>Tulokset, kokoonpanot ja tilastot haetaan liiga.fi:stä. Ennuste lasketaan uudelleen joka aamu ja otteluiltoina
            tulosten valmistuttua. Sivun yläkulman aikaleima kertoo viimeisimmän laskennan.</p>
        </section>

        <section>
          <h2>Sarjan rajat</h2>
          <p>Kuusi parasta pääsee suoraan puolivälieriin, sijat 7–10 pelaavat karsinnan ja sijat 15–17 jäävät putoamisviivan alle.
            Sijoitusten todennäköisyydet ovat <Link href="/sijainti">Sijainnit-sivulla</Link>.</p>
        </section>

        <p className="about-fine">Epävirallinen harrastesivu, ei Liigan eikä seurojen palvelu. Todennäköisyydet ovat mallin arvioita,
          eivät vedonlyöntivihjeitä.</p>
      </article>
    </Shell>
  );
}
