// "Kuka on kuumana?" -sarjataulukko. Laskenta on sama kuin streamlit_app.py:n
// render_form_table (lib/table.ts); ulkoasu on oma: logot, vyöhykkeet rivin
// reunassa, animoidut pistepalkit ja korostuksen hehku.
import Link from "next/link";
import { Game, PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT, logo, rankMovement, rolling, seasonTable, teamPoints } from "@/lib/table";

const BRAND_DARK = "#EBCA68", MUTED = "#8f8573";

function Spark({ vals, w = 96, h = 28 }: { vals: number[]; w?: number; h?: number }) {
  if (vals.length < 2) return <span className="dim">–</span>;
  const px = (k: number) => 3 + (k / (vals.length - 1)) * (w - 6);
  const py = (v: number) => h - 4 - (v / 3) * (h - 8);
  const line = vals.map((v, k) => `${k ? "L" : "M"}${px(k).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const half = Math.max(Math.floor(vals.length / 2), 1);
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const rising = avg(vals.slice(-half)) >= avg(vals.slice(0, half));
  const c = rising ? BRAND_DARK : MUTED;
  const id = `g${Math.round(vals.reduce((s, x) => s + x * 7, 0) * 1000)}${vals.length}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="spark" aria-label={`vire ${avg(vals).toFixed(2)} p/ottelu`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity=".28" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={0} y1={py(1.5)} x2={w} y2={py(1.5)} className="spark-mid" />
      <path d={`${line} L${px(vals.length - 1)} ${h - 2} L3 ${h - 2} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(vals.length - 1)} cy={py(vals[vals.length - 1])} r={2.6} fill={c} />
    </svg>
  );
}

const RESULT: Record<number, [string, string, string]> = {
  3: ["V", "res res-w", "Voitto"], 2: ["J", "res res-otw", "Voitto jatkoajalla"],
  1: ["H", "res res-otl", "Häviö jatkoajalla"], 0: ["H", "res res-l", "Häviö"],
};

function Form({ points }: { points: number[] }) {
  const last = points.slice(-5);
  return (
    <div className="form">
      {Array.from({ length: 5 - last.length }, (_, i) => <span key={`e${i}`} className="res res-empty" />)}
      {last.map((p, i) => { const [l, c, t] = RESULT[p] ?? RESULT[0]; return <span key={i} className={c} title={t}>{l}</span>; })}
    </div>
  );
}

const zoneOf = (rank: number) => (rank <= PLAYOFF_CUT ? "z-top" : rank <= QUALI_CUT ? "z-quali" : rank > RELEGATION_CUT ? "z-down" : "z-mid");

function Move({ mv, window }: { mv: number | null | undefined; window: number }) {
  if (mv == null) return <span className="mv mv-na" title={`Sijamuutos näytetään, kun joukkue on pelannut vähintään ${2 * window} ottelua`}>·</span>;
  if (mv === 0) return <span className="mv mv-0" title={`Sama sija kuin ${window} ottelua sitten`}>=</span>;
  return <span className={`mv ${mv > 0 ? "mv-up" : "mv-dn"}`} title={`${mv > 0 ? "Noussut" : "Laskenut"} ${Math.abs(mv)} sijaa viimeisen ${window} ottelun aikana`}>{mv > 0 ? "▲" : "▼"}{Math.abs(mv)}</span>;
}

export default function FormTable({ log, teams, window, highlight, showSpark, showXg }: {
  log: Game[]; teams: string[]; window: number; highlight: Set<string>; showSpark: boolean; showXg: boolean;
}) {
  const t = seasonTable(log, teams);
  const moves = rankMovement(log, window, teams);
  const maxPts = Math.max(...t.map((r) => r.pts), 1);
  const fmt = (x: number) => x.toFixed(1).replace(".", ",");

  return (
    <div className={`tbl ${highlight.size ? "has-hl" : ""}`} role="table" aria-label="Sarjataulukko ja vire">
      <div className={`tr th ${showXg ? "with-xg" : ""} ${showSpark ? "" : "no-spark"}`} role="row">
        <div>#</div><div>Joukkue</div><div className="num">O</div>
        <div className="num hide-sm">V–JV–JH–H</div>
        {showXg && <div className="num hide-sm">xG %</div>}
        <div>Muoto</div>
        {showSpark && <div className="hide-sm">Vire ({window})</div>}
        <div className="num hide-sm">Maalit</div><div>Pisteet</div>
      </div>
      {t.map((r, i) => {
        const rank = i + 1;
        const pts = teamPoints(log, r.team);
        const hl = highlight.has(r.team);
        const sep = rank === PLAYOFF_CUT + 1 || rank === QUALI_CUT + 1 || rank === RELEGATION_CUT + 1;
        return (
          <div key={r.team} role="row"
            className={`tr ${zoneOf(rank)} ${hl ? "hl" : ""} ${sep ? "sep" : ""} ${showXg ? "with-xg" : ""} ${showSpark ? "" : "no-spark"}`}
            style={{ animationDelay: `${i * 18}ms` }}>
            <div className="rank">{rank}</div>
            <Link href={`/joukkue/${encodeURIComponent(r.team)}`} className="team team-link">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo(r.team)} alt="" width={22} height={22} />
              <span className="name">{r.team}</span>
              <Move mv={moves.get(r.team)} window={window} />
            </Link>
            <div className="num dim">{r.gp}</div>
            <div className="num dim hide-sm">{r.w}–{r.otw}–{r.otl}–{r.l}</div>
            {showXg && <div className="num hide-sm">{r.xgShare == null ? "–" : fmt(r.xgShare)}</div>}
            <div><Form points={pts} /></div>
            {showSpark && <div className="hide-sm"><Spark vals={rolling(pts, window)} /></div>}
            <div className="num hide-sm"><span>{r.gf}–{r.ga}</span> <span className={`gd ${r.gf - r.ga >= 0 ? "pos" : "neg"}`}>{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</span></div>
            <div className="pts">
              <div className="bar"><i style={{ width: `${((100 * r.pts) / maxPts).toFixed(1)}%` }} /></div>
              <b>{r.pts}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}
