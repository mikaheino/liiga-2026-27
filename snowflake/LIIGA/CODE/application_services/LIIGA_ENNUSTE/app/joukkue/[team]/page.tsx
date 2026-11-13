// Joukkueen drilldown etusivun heatmapista: sijajakauma isona, ennuste,
// viimeiset ja seuraavat ottelut ja ennusteen liike. ◀ ▶ selaa joukkueita
// ennustetussa järjestyksessä kuin NHL 95:n joukkuevalinta.
import Link from "next/link";
import { notFound } from "next/navigation";
import AbsenceCard from "@/components/AbsenceCard";
import CardAgent from "@/components/CardAgent";
import { FixtureList } from "@/components/Fixtures";
import History from "@/components/History";
import Scenario from "@/components/Scenario";
import Shell from "@/components/Shell";
import { loadAbsence, loadChallengerSeason, loadFixtures, loadHistory, loadLog, loadPosition, loadSeasonQuestions, loadTeams, teamHref } from "@/lib/data";
import { PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT, TEAMS, fi, logo, seasonTable } from "@/lib/table";
import { STATIC } from "@/lib/target";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }) {
  return { title: decodeURIComponent((await params).team) };
}

const zone = (k: number) => (k <= PLAYOFF_CUT ? "z-top" : k <= QUALI_CUT ? "z-quali" : k > RELEGATION_CUT ? "z-down" : "z-mid");

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const team = decodeURIComponent((await params).team);
  const [pos, log, teams, fixtures, { history, preseason }, season, absence, questions] = await Promise.all([
    loadPosition(), loadLog(), loadTeams(), loadFixtures(), loadHistory(), loadChallengerSeason(),
    // Poissaolokortti: moottorin puute (esim. proseduuri ei vielä julkaistu) ei kaada sivua.
    loadAbsence(decodeURIComponent((await params).team)).catch((e) => { console.log(`[data] poissaolot: ${(e as Error).message}`); return null; }),
    loadSeasonQuestions().catch(() => []),
  ]);
  const ch = season.teams.find((t) => t.team === team && Math.abs(t.points - t.pointsNow) >= 0.3);
  const i = pos.findIndex((r) => r.team === team);
  if (i < 0) notFound();
  const r = pos[i];
  const prev = pos[(i - 1 + pos.length) % pos.length].team, next = pos[(i + 1) % pos.length].team;
  const table = seasonTable(log, teams);
  const now = table.findIndex((t) => t.team === team);
  const sum = (a: number, b: number) => 100 * r.p.slice(a - 1, b).reduce((s, x) => s + x, 0);
  const peak = r.p.indexOf(Math.max(...r.p)) + 1;
  const max = Math.max(...r.p);
  const mine = fixtures.filter((f) => f.home === team || f.away === team);
  const played = mine.filter((f) => f.ended).slice(-5), coming = mine.filter((f) => !f.ended).slice(0, 5);
  const base = preseason.get(team);
  const q = `?joukkue=${encodeURIComponent(team)}`;

  // Agentti joukkuesivulla (5.11.): kysymys sidotaan joukkueeseen (kausi:joukkue).
  // Valmiit kysymykset vain datan syystä: ennuste liikkui viikossa, kuuden joukko
  // on auki tai putoaminen uhkaa. Ilman syytä ei sirua, vain kenttä.
  const seasonNo = Math.max(...fixtures.map((f) => f.season ?? 0));
  const mineHist = history.filter((h) => h.team === team);
  const last = mineHist.at(-1);
  const weekAgo = last ? [...mineHist].reverse().find((h) => h.date <= new Date(Date.parse(last.date) - 7 * 864e5).toISOString().slice(0, 10)) : undefined;
  const dWeek = last && weekAgo ? last.points - weekAgo.points : 0;
  const top6 = sum(1, PLAYOFF_CUT), rel = sum(RELEGATION_CUT + 1, TEAMS);
  // "Mitä vaaditaan" ei ole agentin siru (6.11.): skenaariopaneeli laskee sen suoraan.
  const chips = [
    Math.abs(dWeek) >= 3 ? `Miksi ennuste ${dWeek < 0 ? "laski" : "nousi"} viikossa ${fi(Math.abs(dWeek))} pistettä?` : null,
  ].filter((c): c is string => !!c);
  if (!chips.length && base != null && Math.abs(r.points - base) >= 5) chips.push("Miksi ennuste on muuttunut esikaudesta?");
  // Kauden kysymyksen siru (V7): joukkueen kysymys liikkui viikossa vähintään 5 %-yks.
  for (const sq of questions.filter((x) => x.team === team && x.dWeek != null && Math.abs(x.dWeek) >= 5)) {
    chips.unshift(`Miksi ${sq.short} ${sq.dWeek! > 0 ? "nousi" : "laski"} viikossa?`);
  }
  // Poissaolosiru vain, kun kortti näkyy (kynnys ylittyi).
  if (absence?.show) chips.unshift("Mitä poissaolot tarkoittavat?");
  // Skenaariopaneelin oletustavoite: se, joka on joukkueelle ajankohtaisin (6.11.).
  const top10 = sum(1, QUALI_CUT);
  const goal = rel >= 15 ? "avoid_relegation" : top10 > 5 && top10 < 95 ? "top10" : top6 > 5 && top6 < 95 ? "top6" : "win";

  return (
    <Shell active="" title={team} rail={false}>
      <section className="team-hero">
        <Link href={teamHref(prev)} className="flip" aria-label={`Edellinen: ${prev}`}>◀</Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo(team)} alt="" width={96} height={96} className="team-logo" />
        <div className="team-id">
          <div className="label">Ennuste · {r.projRank}. sija</div>
          <h1>{team}</h1>
          <div className="team-sub">
            <b>{Math.round(r.points)} p</b> ({Math.round(r.p05)}–{Math.round(r.p95)})
            {base != null && <> · esikaudesta {r.points - base > 0 ? "+" : ""}{fi(r.points - base)}</>}
            {now >= 0 && <> · sarjassa nyt {now + 1}. ({table[now].pts} p)</>}
          </div>
          {ch && <div className="team-ch">Haastaja poissaoloilla: {fi(ch.points)} p · top 6 {fi(100 * ch.top, 0)} %</div>}
        </div>
        <div className="team-odds">
          <div><span>{fi(r.pTitle)} %</span>voittaa</div>
          <div><span>{fi(sum(1, PLAYOFF_CUT), 0)} %</span>1.–{PLAYOFF_CUT}.</div>
          <div><span>{fi(sum(PLAYOFF_CUT + 1, QUALI_CUT), 0)} %</span>{PLAYOFF_CUT + 1}.–{QUALI_CUT}.</div>
          <div className="dn"><span>{fi(sum(RELEGATION_CUT + 1, TEAMS), 0)} %</span>putoaa</div>
        </div>
        <Link href={teamHref(next)} className="flip" aria-label={`Seuraava: ${next}`}>▶</Link>
      </section>

      <section className="dist" aria-label="Sijajakauma">
        {r.p.map((p, k) => (
          <div key={k} className={`dcol ${zone(k + 1)} ${k + 1 === peak ? "peak" : ""}`} title={`Sija ${k + 1}: ${fi(100 * p)} %`}>
            <span className="dv">{p >= 0.005 ? Math.round(100 * p) : ""}</span>
            <i style={{ height: `${(100 * p) / max}%`, animationDelay: `${k * 35}ms` }} />
            <span className="dk">{k + 1}</span>
          </div>
        ))}
      </section>

      <div className="team-grid">
        <div>
          <div className="label">Viimeiset</div>
          <FixtureList fixtures={played} highlight={new Set()} all={fixtures} />
          <div className="label sub">Seuraavat</div>
          <FixtureList fixtures={coming} highlight={new Set()} all={fixtures} />
        </div>
        <div>
          <div className="label">Ennusteen liike</div>
          <History history={history} order={[team]} highlight={new Set()} preseason={preseason} big />
          {absence?.show && <div className="team-agent"><AbsenceCard a={absence} /></div>}
          <div className="team-agent"><Scenario team={team} defaultGoal={goal} /></div>
          {!STATIC && seasonNo > 0 && (
            <div className="team-agent"><CardAgent subject={{ type: "team", key: `${seasonNo}:${team}` }} chips={chips} placeholder={`Kysy joukkueesta ${team}…`} /></div>
          )}
          <nav className="jumps">
            <Link href={`/sarjataulukko${q}`}>▶ Sarjataulukossa</Link>
            <Link href={`/voittaja${q}`}>▶ Voittajakisassa</Link>
            <Link href={`/ottelut${q}`}>▶ Kaikki ottelut</Link>
            <Link href={`/liike${q}`}>▶ Muita vasten</Link>
          </nav>
        </div>
      </div>
    </Shell>
  );
}
