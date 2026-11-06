// Päivän tarina ja ratkaisupeli etusivun yläosassa (7.11.2026, käyttäjä: etusivu "tylsä").
// Tarina: iso lause, luku laskee näkyviin ja kausikäyrä piirtyy (lib/dayStory.ts).
// Ratkaisupeli: seuraavan kierroksen ottelu, jonka tulos liikuttaa jonkun tavoitetta eniten
// (moottorin panos); napautus avaa ottelukortin, josta tuloksen voi lukita.
import Link from "next/link";
import MatchTap from "@/components/MatchCard";
import { CountUp } from "@/components/Motion";
import { fixtureKey } from "@/lib/challenger";
import type { Challenger, NewsItem, Stake } from "@/lib/data";
import { teamHref } from "@/lib/data";
import type { Story } from "@/lib/dayStory";
import type { Fixture } from "@/lib/fixtures";
import { matchDetail } from "@/lib/matchDetail";
import { shown, stakeLabel, stakePct, worthShowing } from "@/lib/stakeText";
import { logo } from "@/lib/table";

const W = 600, H = 90;

function Curve({ s }: { s: Story }) {
  if (s.series.length < 2) return null;
  const t = s.series.map((p) => Date.parse(p.date));
  const x0 = Math.min(...t), x1 = Math.max(...t);
  const pts = s.series.map((p, i) => [((t[i] - x0) / Math.max(1, x1 - x0)) * W, H - 4 - p.p * (H - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="story-curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path d={`${d}L${W},${H}L0,${H}Z`} className="story-area" />
      <path d={d} className="story-line" pathLength={1} />
      <circle cx={lx} cy={ly} r="4" className="story-dot" />
    </svg>
  );
}

export function DayStory({ story }: { story: Story | null }) {
  if (!story) return null;
  const from = Math.round(100 * story.from), to = Math.round(100 * story.to);
  return (
    <Link href={teamHref(story.team)} className="story" aria-label={`${story.title}: ${story.metric} ${from} → ${to} %`}>
      <div className="label">Päivän tarina</div>
      <h2 className="story-h">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo(story.team)} alt="" width={40} height={40} />
        <span>{story.title}</span>
      </h2>
      <div className="story-v">
        <span className="story-m">{story.metric}</span>
        <span className="story-from">{from} %</span>
        <span className="story-arrow" aria-hidden>→</span>
        <b><CountUp from={from} to={to} ms={1800} suffix=" %" /></b>
      </div>
      <Curve s={story} />
    </Link>
  );
}

const when = new Intl.DateTimeFormat("fi-FI", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" });

export function KeyGame({ games, stakes, all, news, challenger }: {
  games: Fixture[]; stakes: Map<number, Stake>; all: Fixture[]; news: NewsItem[]; challenger: Map<string, Challenger>;
}) {
  const ranked = games.map((g) => ({ g, s: stakes.get(g.gameId ?? -1) }))
    .filter((x) => worthShowing(x.s?.top)).sort((a, b) => Math.abs(b.s!.top.delta) - Math.abs(a.s!.top.delta));
  if (!ranked.length) return null;
  const { g, s } = ranked[0];
  const t = s!.top;
  return (
    <MatchTap d={{ ...matchDetail(g, all, news, challenger.get(fixtureKey(g))), stake: s! }}>
      <div className="keygame">
        <div className="label">Ratkaisupeli · {when.format(new Date(g.start_ts))}</div>
        <div className="kg-teams">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo(g.home)} alt="" width={34} height={34} /><span>{g.home}</span>
          <i>–</i>
          <span>{g.away}</span>{/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo(g.away)} alt="" width={34} height={34} />
        </div>
        <div className="kg-swing">
          <span className="kg-l">{stakeLabel(t)}</span>
          <span className="kg-side"><b>{stakePct(shown(t, t.p_home_win))}</b> jos {g.home} voittaa</span>
          <span className="kg-side"><b>{stakePct(shown(t, t.p_away_win))}</b> jos {g.away} voittaa</span>
        </div>
        <div className="kg-go">Avaa ottelukortti ▶</div>
      </div>
    </MatchTap>
  );
}
