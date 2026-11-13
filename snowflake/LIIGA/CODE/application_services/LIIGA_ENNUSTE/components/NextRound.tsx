// Seuraavan kierroksen ennuste etusivulla heti kauden tilanteen alla (27.10.):
// puhelimesta yhdellä silmäyksellä kuka on suosikki. Palkki = kotivoiton
// todennäköisyys (jatkoaika mukaan lukien) vs. vierasvoitto; suosikin nimi kirkas.
import Link from "next/link";
import MatchTap from "@/components/MatchCard";
import { compactNotes, fixtureKey } from "@/lib/challenger";
import type { Challenger, NewsItem, Stake } from "@/lib/data";
import type { Fixture } from "@/lib/fixtures";
import { matchDetail } from "@/lib/matchDetail";
import { shown, stakeLabel, stakePct, worthShowing } from "@/lib/stakeText";
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

export default function NextRound({ games, challenger, all = [], news = [], stakes }: {
  games: Fixture[]; challenger?: Map<string, Challenger>; all?: Fixture[]; news?: NewsItem[]; stakes?: Map<number, Stake>;
}) {
  if (!games.length) return null;
  const days = [...new Set(games.map((g) => dayName.format(new Date(g.start_ts))))];
  return (
    <section className="nround" aria-label="Seuraavan kierroksen ennuste">
      <div className="nr-head">
        <div className="label">Seuraava kierros</div>
        <span className="nr-days">{days.join(" – ")}</span>
      </div>
      {/* Panos (6.11.): ottelun tuloksen vaikutus joukkueen elävimpään tavoitteeseen. */}
      {games.some((g) => worthShowing(stakes?.get(g.gameId ?? -1)?.top)) && (
        <p className="nr-legend">Panos: todennäköisyys, jos koti voittaa ↔ jos vieras voittaa</p>
      )}
      {days.map((d) => (
        <div key={d} className="nr-day">
          {days.length > 1 && <div className="nr-date">{d}</div>}
          {games.filter((g) => dayName.format(new Date(g.start_ts)) === d).map((g) => {
            const h = g.pHome == null ? null : 100 * g.pHome;
            return (
              <MatchTap key={g.start_ts + g.home} d={{ ...matchDetail(g, all, news, challenger?.get(fixtureKey(g))), stake: stakes?.get(g.gameId ?? -1) ?? null }}>
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
                    const short = compactNotes(c.notes);
                    return <span className="nr-ch" title={c.notes || undefined}>Haastaja {Math.round(100 * c.pHome)} – {Math.round(100 * (1 - c.pHome))} %{short ? ` · ${short}` : ""}</span>;
                  })()}
                  {(() => {
                    const t = stakes?.get(g.gameId ?? -1)?.top;
                    if (!t || !worthShowing(t)) return null;
                    return <span className="nr-stake">Panos · {stakeLabel(t)} <b>{stakePct(shown(t, t.p_home_win))}</b> ↔ <b>{stakePct(shown(t, t.p_away_win))}</b></span>;
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
