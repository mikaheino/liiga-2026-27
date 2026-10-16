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

function sigma(p: number[]) {
  const mean = p.reduce((s, x, i) => s + x * (i + 1), 0);
  const ex2 = p.reduce((s, x, i) => s + x * (i + 1) ** 2, 0);
  return Math.sqrt(Math.max(ex2 - mean * mean, 0));
}

const edge = (rank: number) => (rank === PLAYOFF_CUT + 1 ? "e-top" : rank === QUALI_CUT + 1 ? "e-quali" : rank === RELEGATION_CUT + 1 ? "e-down" : "");

export default function Heatmap({ rows, highlight }: { rows: PositionRow[]; highlight: Set<string> }) {
  const ranks = Array.from({ length: TEAMS }, (_, i) => i + 1);
  const sd = rows.map((r) => ({ team: r.team, s: sigma(r.p) })).sort((a, b) => b.s - a.s);
  const f1 = (x: number) => x.toFixed(1).replace(".", ",");
  return (
    <>
      <div className={`heat ${highlight.size ? "has-hl" : ""}`} role="table" aria-label="Sijaintijakauma">
        <div className="hr hh" role="row">
          <div className="ht">Joukkue</div>
          {ranks.map((k) => <div key={k} className={`hc ${edge(k)}`}>{k}</div>)}
          <div className="hp">Pisteet</div>
        </div>
        {rows.map((r) => (
          <div key={r.team} role="row" className={`hr ${highlight.has(r.team) ? "hl" : ""}`}>
            <div className="ht">
              <span className="hrank">{r.projRank}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo(r.team)} alt="" width={18} height={18} />
              <span className="name">{r.team}</span>
            </div>
            {ranks.map((k) => (
              <div key={k} className={`hc ${edge(k)}`} style={cell(r.p[k - 1])}
                title={`${r.team}: sija ${k} -- ${(r.p[k - 1] * 100).toFixed(1).replace(".", ",")} %`}>{label(r.p[k - 1])}</div>
            ))}
            <div className="hp"><b>{Math.round(r.points)}</b><span>{Math.round(r.p05)}–{Math.round(r.p95)}</span></div>
          </div>
        ))}
      </div>
      <p className="note">
        Todennäköisyys prosentteina 10 000 simuloidusta kaudesta. Kirkas viiva erottaa suoraan puolivälieriin menevät (1.–{PLAYOFF_CUT}.), katkoviiva karsinnan ({PLAYOFF_CUT + 1}.–{QUALI_CUT}.) ja punainen viiva putoajat ({RELEGATION_CUT + 1}.–{TEAMS}.).
        {" "}<b>Villit kortit:</b> {sd.slice(0, 2).map((x) => `${x.team} (σ ${f1(x.s)})`).join(", ")}.
        {" "}<b>Varmimmat:</b> {sd.slice(-2).reverse().map((x) => `${x.team} (σ ${f1(x.s)})`).join(", ")}.
      </p>
    </>
  );
}
