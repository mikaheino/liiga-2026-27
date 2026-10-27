// Seuraavan kierroksen ennuste etusivulla heti kauden tilanteen alla (27.10.):
// puhelimesta yhdellä silmäyksellä kuka on suosikki. Palkki = kotivoiton
// todennäköisyys (jatkoaika mukaan lukien) vs. vierasvoitto; suosikin nimi kirkas.
import Link from "next/link";
import { fixtureKey } from "@/lib/challenger";
import type { Challenger } from "@/lib/data";
import { type Fixture } from "@/lib/fixtures";
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

export default function NextRound({ games, challenger }: { games: Fixture[]; challenger?: Map<string, Challenger> }) {
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
              <div key={g.start_ts + g.home} className="nr-game">
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
            );
          })}
        </div>
      ))}
      <Link href="/ottelut" className="nr-all">Kaikki ottelut ▶</Link>
    </section>
  );
}
