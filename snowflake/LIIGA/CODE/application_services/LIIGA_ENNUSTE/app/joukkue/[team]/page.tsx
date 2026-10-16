// Joukkueen drilldown etusivun heatmapista: sijajakauma isona, ennuste,
// viimeiset ja seuraavat ottelut ja ennusteen liike. ◀ ▶ selaa joukkueita
// ennustetussa järjestyksessä kuin NHL 95:n joukkuevalinta.
import Link from "next/link";
import { notFound } from "next/navigation";
import { FixtureList } from "@/components/Fixtures";
import History from "@/components/History";
import Shell from "@/components/Shell";
import { loadFixtures, loadHistory, loadLog, loadPosition, loadTeams, teamHref } from "@/lib/data";
import { PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT, TEAMS, fi, logo, seasonTable } from "@/lib/table";

export const dynamic = "force-dynamic";

const zone = (k: number) => (k <= PLAYOFF_CUT ? "z-top" : k <= QUALI_CUT ? "z-quali" : k > RELEGATION_CUT ? "z-down" : "z-mid");

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const team = decodeURIComponent((await params).team);
  const [pos, log, teams, fixtures, { history, preseason }] = await Promise.all([
    loadPosition(), loadLog(), loadTeams(), loadFixtures(), loadHistory(),
  ]);
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
          <FixtureList fixtures={played} highlight={new Set()} />
          <div className="label sub">Seuraavat</div>
          <FixtureList fixtures={coming} highlight={new Set()} />
        </div>
        <div>
          <div className="label">Ennusteen liike</div>
          <History history={history} order={[team]} highlight={new Set()} preseason={preseason} big />
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
