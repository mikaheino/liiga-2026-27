// "Mihin kukin joukkue päätyy" -- sijaintijakauma 17 x 17. Logiikka sama kuin
// streamlit_app.py:n position_matrix / _cell_style / rank_stdev: rivit ennustetussa
// järjestyksessä, potenssiramppi (tasaiset keskikastin rivit pysyvät näkyvinä).
// Rajaviivat (käyttäjä 25.10.): 4 parasta kulta, 12 parasta hopea, 14 parasta
// paksu punainen. Kun `need` annetaan, ennustettujen pisteiden sarake vaihtuu kahteen
// (käyttäjä 25.10.): montako pistettä 14 parhaan todennäköiseen ja varmaan rajaan
// vielä puuttuu ja mitä se vaatii per jäljellä oleva ottelu.
import Link from "next/link";
import { RELEGATION_CUT, TEAMS, fi, logo } from "@/lib/table";

export type PositionRow = { team: string; projRank: number; points: number; p05: number; p95: number; p: number[] };
export type Need = { pts: number; left: number };   // nykyiset pisteet, jäljellä olevat ottelut
// Pisteraja: todennäköinen (50 %) ja varma (95 %) simulaatiosta, nyt = sijan `rank` pisteet taulukossa.
export type Line = { rank: number; likely: number; safe: number; now: number | null };

export const DEFAULT_LINE = 80;   // ennen kuin PREDICTION_META kertoo rajan
const GOLD_CUT = 4, SILVER_CUT = 12, RED_CUT = RELEGATION_CUT;   // 14

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

const edge = (rank: number) => (rank === GOLD_CUT + 1 ? "e-gold" : rank === SILVER_CUT + 1 ? "e-silver" : rank === RED_CUT + 1 ? "e-red" : "");

// Vaarallinen tahti (käyttäjä 25.10.). Kaudet 2022-26, ottelut 17. jälkeen, 77
// joukkuekautta: tahtiin 1,50 p/ott ylsi 52 % joukkueista (vaatii keskitasoa
// paremman loppukauden), 1,30:een 73 %.
const DANGER_RATE = 1.5, WARN_RATE = 1.3;
const risk = (rate: number) => (rate >= DANGER_RATE ? "danger" : rate >= WARN_RATE ? "warn" : "");

// Puuttuvat pisteet rajaan ja vaadittu tahti: (raja - pisteet nyt) / jäljellä olevat ottelut.
function NeedCell({ n, target, kind }: { n?: Need; target: number; kind: string }) {
  if (!n) return <div className="hn" />;
  const need = target - n.pts;
  if (need <= 0) return <div className="hn ok" title={`${n.pts} p: ${kind} raja ${target} p saavutettu`}><b>✓</b><span>{n.pts} p</span></div>;
  const rate = n.left > 0 ? need / n.left : Infinity;
  return (
    <div className={`hn ${risk(rate)}`} title={`${n.pts} p nyt, ${n.left} ottelua jäljellä: ${kind} raja ${target} p, puuttuu ${need} p = ${fi(rate, 2)} p/ottelu${rate >= DANGER_RATE ? " -- vaarallinen: historiassa enintään puolet joukkueista on pelannut loppukauden näin" : rate >= WARN_RATE ? " -- lähestyy vaarallista: historiassa noin neljännes joukkueista jäi tästä" : ""}`}>
      <b>+{need}</b><span>{Number.isFinite(rate) ? `${fi(rate, 2)}/ott` : "ei mahd."}</span>
    </div>
  );
}

// Todennäköisin sija hehkuu taustalla (globals.css: .peak).
const peakOf = (p: number[]) => p.indexOf(Math.max(...p)) + 1;

// `link` tekee rivistä drilldownin joukkuesivulle (etusivu).
export default function Heatmap({ rows, highlight, link, need, line }: {
  rows: PositionRow[]; highlight: Set<string>; link?: (team: string) => string; need?: Map<string, Need>; line?: Line | null;
}) {
  const target = line?.likely ?? DEFAULT_LINE;
  const ranks = Array.from({ length: TEAMS }, (_, i) => i + 1);
  return (
    <div className={`heat ${highlight.size ? "has-hl" : ""} ${need ? (line ? "with-need2" : "with-need") : ""}`} role="table" aria-label="Sijaintijakauma">
      <div className="hr hh" role="row">
        <div className="ht">Joukkue</div>
        {ranks.map((k) => <div key={k} className={`hc ${edge(k)}`}>{k}</div>)}
        {!need && <div className="hp">Pisteet</div>}
        {need && <div className="hn" title={`Todennäköinen 14 parhaan raja: riittää puolessa simulaatioista`}><b>{target} p</b><span>tod.näk.</span></div>}
        {need && line && <div className="hn" title={`Varma 14 parhaan raja: riittää 95 %:ssa simulaatioista`}><b>{line.safe} p</b><span>varma</span></div>}
      </div>
      {rows.map((r, i) => {
        const cls = `hr ${highlight.has(r.team) ? "hl" : ""} ${link ? "go" : ""}`;
        const cells = (<>
          <div className="ht">
            <span className="hrank">{r.projRank}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo(r.team)} alt="" width={18} height={18} />
            <span className="name">{r.team}</span>
          </div>
          {ranks.map((k) => (
            <div key={k} className={`hc ${edge(k)} ${k === peakOf(r.p) ? "peak" : ""}`} style={{ ...cell(r.p[k - 1]), "--d": `${(i + k) * 14}ms` } as React.CSSProperties}
              title={`${r.team}: sija ${k} -- ${(r.p[k - 1] * 100).toFixed(1).replace(".", ",")} %`}>{label(r.p[k - 1])}</div>
          ))}
          {!need && <div className="hp"><b>{Math.round(r.points)}</b><span>{Math.round(r.p05)}–{Math.round(r.p95)}</span></div>}
          {need && <NeedCell n={need.get(r.team)} target={target} kind="todennäköinen" />}
          {need && line && <NeedCell n={need.get(r.team)} target={line.safe} kind="varma" />}
        </>);
        return link
          ? <Link key={r.team} href={link(r.team)} role="row" className={cls} aria-label={`${r.team}: avaa joukkue`}>{cells}</Link>
          : <div key={r.team} role="row" className={cls}>{cells}</div>;
      })}
    </div>
  );
}
