// Välilehdet Koti / vieras, Maalinteko ja Erikoistilanteet -- streamlit_app.py:n
// render_split_table, render_goals_table ja render_special_table.
import Grid, { Team, zoneOf } from "@/components/Grid";
import { type Game, fi, splitTable, statTable } from "@/lib/table";

const rank = (i: number) => <span className="rank-n">{i + 1}</span>;
const RANK = { h: "#", w: "46px" }, TEAM = { h: "Joukkue", w: "minmax(140px, 1.4fr)" };

export function SplitTable({ log, teams, highlight }: { log: Game[]; teams: string[]; highlight: Set<string> }) {
  const t = splitTable(log, teams);
  return (
    <Grid label="Koti ja vieras" cols={[RANK, TEAM, { h: "Koti O", w: "70px", num: true }, { h: "Koti P", w: "70px", num: true },
      { h: "Koti maalit", w: "100px", num: true, sm: true }, { h: "Vieras O", w: "80px", num: true }, { h: "Vieras P", w: "80px", num: true },
      { h: "Vieras maalit", w: "110px", num: true, sm: true }]}
      rows={t.map((r, i) => ({
        key: r.team, cls: zoneOf(i + 1), on: highlight.has(r.team),
        cells: [rank(i), <Team key="t" name={r.team} />, <span key="a" className="dim">{r.home.gp}</span>, <b key="b">{r.home.pts}</b>,
          <span key="c" className="dim">{r.home.gf}–{r.home.ga}</span>, <span key="d" className="dim">{r.away.gp}</span>, <b key="e">{r.away.pts}</b>,
          <span key="f" className="dim">{r.away.gf}–{r.away.ga}</span>],
      }))} />
  );
}

export function GoalsTable({ log, teams, highlight }: { log: Game[]; teams: string[]; highlight: Set<string> }) {
  const t = statTable(log, teams);
  return (
    <Grid label="Maalinteko" cols={[RANK, TEAM, { h: "O", w: "40px", num: true }, { h: "TM", w: "54px", num: true }, { h: "PM", w: "54px", num: true },
      { h: "TM/O", w: "70px", num: true }, { h: "PM/O", w: "70px", num: true }, { h: "xG puolesta", w: "96px", num: true, sm: true },
      { h: "xG vastaan", w: "96px", num: true, sm: true }, { h: "xG %", w: "70px", num: true }]}
      rows={t.map((r, i) => ({
        key: r.team, cls: zoneOf(i + 1), on: highlight.has(r.team),
        cells: [rank(i), <Team key="t" name={r.team} />, <span key="a" className="dim">{r.gp}</span>, r.gf, r.ga, fi(r.gfPg, 2), fi(r.gaPg, 2),
          fi(r.xgf), fi(r.xga), <b key="x">{fi(r.xgShare)}</b>],
      }))} />
  );
}

export function SpecialTable({ log, teams, highlight }: { log: Game[]; teams: string[]; highlight: Set<string> }) {
  const t = statTable(log, teams);
  return (
    <Grid label="Erikoistilanteet" cols={[RANK, TEAM, { h: "O", w: "40px", num: true }, { h: "YV-maalit", w: "84px", num: true, sm: true },
      { h: "YV-kerrat", w: "84px", num: true, sm: true }, { h: "YV %", w: "70px", num: true }, { h: "AV-kerrat", w: "84px", num: true, sm: true },
      { h: "Päästetyt", w: "84px", num: true, sm: true }, { h: "AV %", w: "70px", num: true }]}
      rows={t.map((r, i) => ({
        key: r.team, cls: zoneOf(i + 1), on: highlight.has(r.team),
        cells: [rank(i), <Team key="t" name={r.team} />, <span key="a" className="dim">{r.gp}</span>, r.ppGoals, r.ppInst,
          <b key="p">{fi(r.ppPct)}</b>, r.shInst, r.ppAgainst, <b key="k">{fi(r.pkPct)}</b>],
      }))} />
  );
}
