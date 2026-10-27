// Seuraavan kierroksen ennuste etusivulla heti kauden tilanteen alla (27.10.):
// puhelimesta yhdellä silmäyksellä kuka on suosikki. Palkki = kotivoiton
// todennäköisyys (jatkoaika mukaan lukien) vs. vierasvoitto; suosikin nimi kirkas.
import Link from "next/link";
import MatchTap, { type MatchDetail } from "@/components/MatchCard";
import { fixtureKey } from "@/lib/challenger";
import type { Challenger, NewsItem } from "@/lib/data";
import { type Fixture, resultText } from "@/lib/fixtures";
import { logo } from "@/lib/table";

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fi-FI", { ...o, timeZone: "Europe/Helsinki" });
const dayName = fmt({ weekday: "short", day: "numeric", month: "numeric" });
const clock = fmt({ hour: "2-digit", minute: "2-digit" });

function Side({ team, p, fav, away }: { team: string; p: number; fav: boolean; away?: boolean }) {
  return (
    <span className={`nr-side ${away ? "away" : ""} ${fav ? "fav" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo(team)} alt="" width={20} height={20} />
      <span className="nr-name">{team}</span>
      <b>{Math.round(p)} %</b>
    </span>
  );
}

const short = (ts: string) => `${Number(ts.slice(8, 10))}.${Number(ts.slice(5, 7))}.`;

// Joukkueen tulos ottelusta: V, JV (jatkoaika/vl-voitto), JH, H.
function outcome(f: Fixture, team: string): string {
  const won = (f.home === team) === (f.hg! > f.ag!);
  const extra = f.category === "overtime" || f.category === "shootout";
  return won ? (extra ? "JV" : "V") : (extra ? "JH" : "H");
}

// Ottelukortin sisältö (MatchCard.tsx): palvelimella, korttiin vain valmis data.
function detail(g: Fixture, all: Fixture[], news: NewsItem[], c: Challenger | undefined): MatchDetail {
  const played = all.filter((f) => f.ended && f.hg != null && f.ag != null);
  const form = Object.fromEntries([g.home, g.away].map((t) => [t,
    played.filter((f) => f.home === t || f.away === t).slice(-5).map((f) => outcome(f, t))]));
  const h2h = played.filter((f) => [f.home, f.away].sort().join() === [g.home, g.away].sort().join())
    .map((f) => ({ date: short(f.start_ts), text: `${f.home} ${resultText(f)} ${f.away}` }));
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const nw = news.filter((n) => (n.published || n.fetched) >= since && n.team.split(",").some((t) => t === g.home || t === g.away))
    .slice(0, 4).map((n) => ({ team: n.team.split(",").find((t) => t === g.home || t === g.away) ?? g.home, title: n.title, url: n.url,
      date: short((n.published || n.fetched).slice(0, 10)) }));
  return { when: `${dayName.format(new Date(g.start_ts))} klo ${clock.format(new Date(g.start_ts))}`, home: g.home, away: g.away,
    pHome: g.pHome, pOt: g.pOt, form, h2h, news: nw,
    // Haastaja vain, kun se poikkeaa virallisesta tai sillä on huomioita (maalivahdit, poissaolot).
    ch: c && !Number.isNaN(c.pHome) && (c.notes || g.pHome == null || Math.abs(c.pHome - g.pHome) >= 0.005) ? { pHome: c.pHome, notes: c.notes } : null };
}

export default function NextRound({ games, challenger, all = [], news = [] }: {
  games: Fixture[]; challenger?: Map<string, Challenger>; all?: Fixture[]; news?: NewsItem[];
}) {
  if (!games.length) return null;
  const days = [...new Set(games.map((g) => dayName.format(new Date(g.start_ts))))];
  return (
    <section className="nround" aria-label="Seuraavan kierroksen ennuste">
      <div className="nr-head">
        <div className="label">Seuraava kierros</div>
        <span className="nr-days">{days.join(" – ")}</span>
      </div>
      {days.map((d) => (
        <div key={d} className="nr-day">
          {days.length > 1 && <div className="nr-date">{d}</div>}
          {games.filter((g) => dayName.format(new Date(g.start_ts)) === d).map((g) => {
            const h = g.pHome == null ? null : 100 * g.pHome;
            return (
              <MatchTap key={g.start_ts + g.home} d={detail(g, all, news, challenger?.get(fixtureKey(g)))}>
              <div className="nr-game">
                <span className="nr-time">{clock.format(new Date(g.start_ts))}</span>
                {h == null ? (
                  <span className="nr-match dim">{g.home} – {g.away}</span>
                ) : (<>
                  <div className="nr-match">
                    <Side team={g.home} p={h} fav={h >= 50} />
                    <Side team={g.away} p={100 - h} fav={h < 50} away />
                  </div>
                  <div className="nr-bar" title={`Jatkoaika ${Math.round(100 * (g.pOt ?? 0))} %`}>
                    <i className={h >= 50 ? "fav" : ""} style={{ width: `${h.toFixed(1)}%` }} />
                    <i className={h < 50 ? "fav" : ""} style={{ width: `${(100 - h).toFixed(1)}%` }} />
                  </div>
                  {g.pOt != null && <span className="nr-ot">JA {Math.round(100 * g.pOt)} %</span>}
                  {(() => {
                    const c = challenger?.get(fixtureKey(g));
                    const base = h == null ? null : h / 100;
                    if (!c || base == null || (Math.abs(c.pHome - base) < 0.005 && !c.notes)) return null;
                    return <span className="nr-ch">Haastaja {Math.round(100 * c.pHome)} – {Math.round(100 * (1 - c.pHome))} %{c.notes ? ` · ${c.notes}` : ""}</span>;
                  })()}
                </>)}
              </div>
              </MatchTap>
            );
          })}
        </div>
      ))}
      <Link href="/ottelut" className="nr-all">Kaikki ottelut ▶</Link>
    </section>
  );
}
