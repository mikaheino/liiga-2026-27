// Päivän tarina (7.11.2026): etusivun ylin lause lasketaan datasta, ei kirjoiteta käsin.
// Viikon suurin NOUSU jossakin kauden tavoitteessa (kuuden joukko, pudotuspelit, runkosarjan
// voitto tai etääntyminen putoamisuhasta). Aina nousija, ei romahtaja: sivu ei nosta
// kenenkään vaikeuksia otsikoksi. Luvut ovat julkaistusta sijajakaumasta (ei omaa laskentaa).
import type { PositionRow } from "@/components/Heatmap";
import type { Snap } from "@/lib/data";
import { type QGoal, type QPoint, goalP } from "@/lib/seasonQuestions";

export type Story = { team: string; goal: QGoal; from: number; to: number; title: string; metric: string; series: QPoint[] };

const GOALS: QGoal[] = ["top6", "top10", "win", "relegation"];
const TEXT: Record<QGoal, [string, string]> = {
  top6: ["nousi viikossa kohti kuuden joukkoa", "kuuden joukko"],
  top10: ["nousi viikossa kohti pudotuspelejä", "pudotuspelipaikka"],
  win: ["nousi viikossa kohti runkosarjan voittoa", "runkosarjan voitto"],
  relegation: ["etääntyi viikossa putoamisuhasta", "putoamisuhka"],
};
const MIN_GAIN = 0.05;          // alle 5 %-yks. viikossa ei ole tarina

export function dayStory(snaps: Snap[], now: PositionRow[], today: string): Story | null {
  const weekAgo = new Date(Date.parse(today) - 7 * 864e5).toISOString().slice(0, 10);
  const ref = [...snaps].reverse().find((s) => s.date <= weekAgo);
  if (!ref) return null;
  let best: Story | null = null, bestGain = MIN_GAIN;
  for (const r of now) {
    if (!ref.p[r.team]) continue;
    for (const goal of GOALS) {
      const from = goalP(ref.p[r.team], goal), to = goalP(r.p, goal);
      const gain = goal === "relegation" ? from - to : to - from;
      if (gain < bestGain) continue;
      bestGain = gain;
      const series = [...snaps.filter((s) => s.p[r.team] && s.date < today).map((s) => ({ date: s.date, p: goalP(s.p[r.team], goal) })),
        { date: today, p: to }];
      best = { team: r.team, goal, from, to, title: `${r.team} ${TEXT[goal][0]}`, metric: TEXT[goal][1], series };
    }
  }
  return best;
}
