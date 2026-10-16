// "Kuka voittaa runkosarjan?" -- streamlit_app.py:n render_title_race ja
// render_title_history. Palkki = ennustetut loppupisteet: kirkas osa on jo
// kerätty, himmeä simuloitu loppukausi. Alussa kerätty on suikale, ja se on
// rehellinen viesti: lähes kaikki on vielä simulaatiota.
import { Team, zoneOf } from "@/components/Grid";
import { fi } from "@/lib/table";

export type TitleRow = { team: string; pTitle: number; points: number; banked: number };
export type HistoryPoint = { team: string; date: string; points: number; pTitle: number; games: number };

export function TitleRace({ rows, highlight }: { rows: TitleRow[]; highlight: Set<string> }) {
  const sorted = [...rows].sort((a, b) => b.pTitle - a.pTitle);
  const widest = Math.max(...sorted.map((r) => r.points), 1);
  return (
    <div className={`tbl race ${highlight.size ? "has-hl" : ""}`} role="table" aria-label="Runkosarjan voittaja">
      <div className="tr th race-r" role="row"><div>#</div><div>Joukkue</div><div className="num">Kerätty</div><div>Ennustetut pisteet</div><div className="num">Voittaa</div></div>
      {sorted.map((r, i) => {
        const sim = Math.max(r.points - r.banked, 0);
        return (
          <div key={r.team} role="row" className={`tr race-r ${zoneOf(i + 1)} ${highlight.has(r.team) ? "hl" : ""} ${i === 0 ? "lead" : ""}`} style={{ animationDelay: `${i * 18}ms` }}>
            <div className="rank">{i + 1}</div>
            <Team name={r.team} />
            <div className="num dim">{Math.round(r.banked)}</div>
            <div className="split" title={`${Math.round(r.banked)} kerätty + ${Math.round(sim)} simuloitu = ${Math.round(r.points)}`}>
              <i className="got" style={{ width: `${(100 * r.banked) / widest}%` }} />
              <i className="sim" style={{ width: `${(100 * sim) / widest}%` }} />
              <span>{Math.round(r.points)}</span>
            </div>
            <div className="num"><span className={r.pTitle >= 1 ? "tag" : "dim"}>{fi(r.pTitle)} %</span></div>
          </div>
        );
      })}
    </div>
  );
}

// Mestaruussuosikin vaihtuminen: kuusi kärkeä + korostetut. Kulta-ramppi
// sijan mukaan -- järjestys on itsessään tietoa, jonka kategorinen paletti
// heittäisi pois.
const RAMP = ["#EBCA68", "#CCA752", "#B08F3F", "#9A7C33", "#7A6228", "#5C4A1E"];

export function TitleHistory({ history, top, highlight }: { history: HistoryPoint[]; top: string[]; highlight: Set<string> }) {
  const shown = [...new Set([...top, ...[...highlight].sort()])];
  const dates = [...new Set(history.map((h) => h.date))].sort();
  if (dates.length < 2) return null;
  const W = 900, H = 220, P = { l: 34, r: 12, t: 12, b: 24 };
  const ymax = Math.min(100, Math.max(10, Math.max(...history.filter((h) => shown.includes(h.team)).map((h) => h.pTitle)) * 1.2));
  const x = (d: string) => P.l + (dates.indexOf(d) / (dates.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / ymax) * (H - P.t - P.b);
  const colour = (t: string, i: number) => (highlight.size && !highlight.has(t) ? "#3a3226" : RAMP[Math.min(i, RAMP.length - 1)]);
  const ticks = [0, ymax / 2, ymax].map((v) => Math.round(v));
  // Kuukauden ensimmäinen ajo, mutta ei liian lähelle edellistä merkkiä:
  // 28.6. ja 2.7. kirjoittuivat päällekkäin.
  const months: string[] = [];
  for (const [i, d] of dates.entries()) {
    if (i && d.slice(5, 7) === dates[i - 1].slice(5, 7)) continue;
    if (months.length && x(d) - x(months[months.length - 1]) < 60) continue;
    months.push(d);
  }
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Runkosarjan voiton todennäköisyys ajan mukaan">
        {ticks.map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="gridl" /><text x={P.l - 8} y={y(v) + 4} className="axis" textAnchor="end">{v}</text></g>)}
        {months.map((d) => <text key={d} x={x(d)} y={H - 6} className="axis">{Number(d.slice(8, 10))}.{Number(d.slice(5, 7))}.</text>)}
        {shown.map((t, i) => {
          const pts = history.filter((h) => h.team === t).sort((a, b) => a.date.localeCompare(b.date));
          if (!pts.length) return null;
          const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.date).toFixed(1)} ${y(p.pTitle).toFixed(1)}`).join(" ");
          const last = pts[pts.length - 1];
          const on = !highlight.size || highlight.has(t);
          return (
            <g key={t}>
              <path d={d} pathLength={1} className="draw" fill="none" stroke={colour(t, i)} strokeWidth={on ? 2.4 : 1.2} style={{ animationDelay: `${i * 90}ms` }} />
              {on && <circle cx={x(last.date)} cy={y(last.pTitle)} r={3.5} fill={colour(t, i)} className="pulse" style={{ animationDelay: `${i * 300}ms` }} />}
            </g>
          );
        })}
      </svg>
      <div className="keys">
        {shown.map((t, i) => <span key={t}><i style={{ background: colour(t, i) }} />{t}</span>)}
      </div>
    </div>
  );
}
