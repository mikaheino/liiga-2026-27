// "Mihin kukin joukkue päätyy" -- sijaintijakauma 17 x 17. Logiikka sama kuin
// streamlit_app.py:n position_matrix / _cell_style / rank_stdev: rivit ennustetussa
// järjestyksessä, potenssiramppi (tasaiset keskikastin rivit pysyvät näkyvinä) ja
// rajaviivat playoff-, karsinta- ja putoamisrajalla.
import { PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT, TEAMS, logo } from "@/lib/table";

export type PositionRow = { team: string; projRank: number; points: number; p05: number; p95: number; p: number[] };

function cell(p: number): React.CSSProperties {
  if (!(p >= 0.002)) return { color: "#3e382e" };
  const alpha = Math.min(0.92, Math.pow(p / 0.35, 0.6) * 0.92);
  return {
    background: `rgba(204,167,82,${alpha.toFixed(3)})`,
    color: alpha > 0.45 ? "#140f06" : p >= 0.08 ? "#f4efe4" : "#8f8573",
    fontWeight: p >= 0.2 ? 800 : 600,
  };
}

const label = (p: number) => (!(p >= 0.0005) ? "" : p < 0.005 ? "<1" : String(Math.round(p * 100)));

const edge = (rank: number) => (rank === PLAYOFF_CUT + 1 ? "e-top" : rank === QUALI_CUT + 1 ? "e-quali" : rank === RELEGATION_CUT + 1 ? "e-down" : "");

export default function Heatmap({ rows, highlight }: { rows: PositionRow[]; highlight: Set<string> }) {
  const ranks = Array.from({ length: TEAMS }, (_, i) => i + 1);
  return (
    <div className={`heat ${highlight.size ? "has-hl" : ""}`} role="table" aria-label="Sijaintijakauma">
      <div className="hr hh" role="row">
        <div className="ht">Joukkue</div>
        {ranks.map((k) => <div key={k} className={`hc ${edge(k)}`}>{k}</div>)}
        <div className="hp">Pisteet</div>
      </div>
      {rows.map((r, i) => (
        <div key={r.team} role="row" className={`hr ${highlight.has(r.team) ? "hl" : ""}`}>
          <div className="ht">
            <span className="hrank">{r.projRank}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo(r.team)} alt="" width={18} height={18} />
            <span className="name">{r.team}</span>
          </div>
          {ranks.map((k) => (
            <div key={k} className={`hc ${edge(k)}`} style={{ ...cell(r.p[k - 1]), "--d": `${(i + k) * 14}ms` } as React.CSSProperties}
              title={`${r.team}: sija ${k} -- ${(r.p[k - 1] * 100).toFixed(1).replace(".", ",")} %`}>{label(r.p[k - 1])}</div>
          ))}
          <div className="hp"><b>{Math.round(r.points)}</b><span>{Math.round(r.p05)}–{Math.round(r.p95)}</span></div>
        </div>
      ))}
    </div>
  );
}
