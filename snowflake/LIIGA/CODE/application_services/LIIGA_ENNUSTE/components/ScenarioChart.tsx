"use client";
// Skenaarion kuvaaja (7.11.2026, käyttäjä: "agentti vois piirtää myös automaattisesti odotetua
// pelimallia" -> "Agentti valitsee itse"). Agentti valitsee tyypin (lib/scenarioDescribe.ts,
// KUVAAJA-rivi); data tulee moottorilta (simulate_scenario.py charts()), ei agentilta.
//   pisteet  odotettu pistekertymä ottelu kerrallaan, nyt vs. skenaario, lukitut ottelut pisteinä
//   jakauma  sijajakauma 1.–17., nyt vs. skenaario
//   ottelut  lukittujen otteluiden mallitodennäköisyys
// Värit: nykyennuste harmaa katkoviiva (vertailukohta), skenaario kulta (#ebca68). Tarkistettu
// dataviz-validaattorilla tummaa pintaa vasten: CVD ΔE 23,5 ja kontrasti läpäisevät; harmaa on
// tarkoituksella väritön, ja sarjan kertovat myös viivatyyli, selite ja suorat arvot.
import { useState } from "react";

type Pt = { iso: string | null; date: string; now: number; scenario: number; opponent?: string; locked: boolean };
export type Charts = { focus: string[]; dist: Record<string, { now: number[]; scenario: number[] }>; points: Record<string, Pt[]> };
export type LockedGame = { date: string; game: string; result: string; p_model: number };
export type ChartPick = { type: "pisteet" | "jakauma" | "ottelut"; team?: string } | null | undefined;

const f1 = (x: number) => x.toFixed(1).replace(".", ",");
const pc = (x: number) => (x > 0 && x < 0.005 ? "<1" : String(Math.round(100 * x)));
const W = 640, H = 260, L = 40, R = 86, T = 14, B = 30;

// Agentti ei sanonut (vanha haku tai puuttuva rivi): sama logiikka kuin sen ohjeessa.
export function fallbackPick(locked: number, hasGoal: boolean): ChartPick {
  if (hasGoal) return { type: "jakauma" };
  if (locked > 0 && locked <= 4) return { type: "ottelut" };
  return { type: "pisteet" };
}

function Legend() {
  return (
    <div className="sc-leg" aria-hidden>
      <span><i className="now" />nyt</span><span><i className="scn" />skenaario</span>
    </div>
  );
}

function PointsChart({ pts, team }: { pts: Pt[]; team: string }) {
  const ys = pts.flatMap((p) => [p.now, p.scenario]);
  const lo = Math.floor(Math.min(...ys) / 10) * 10, hi = Math.ceil(Math.max(...ys) / 10) * 10;
  const x = (i: number) => L + (i / Math.max(1, pts.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - B);
  const line = (k: "now" | "scenario") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const ticks = [lo, (lo + hi) / 2, hi];
  const last = pts[pts.length - 1];
  const labelGap = Math.abs(y(last.now) - y(last.scenario)) < 14 ? 8 : 0;   // suorat arvot eivät päälle
  const months = pts.map((p, i) => ({ i, m: p.iso?.slice(5, 7) })).filter((p, k, a) => p.m && (k === 0 || a[k - 1].m !== p.m));
  // Lukittu jakso näkyviin (7.11.2026, käyttäjä: "tämä pitää näkyä ja kertoa"): yhtenäinen jakso
  // kultaisena taustana; hajanaiset lukitukset (esim. joka toinen ottelu) pelkkinä pisteinä.
  const li = pts.map((p, i) => (p.locked ? i : -1)).filter((i) => i >= 0);
  const span = li.length ? { a: li[0], b: li[li.length - 1] } : null;
  const solid = !!span && li.length === span.b - span.a + 1;
  const step = (W - L - R) / Math.max(1, pts.length - 1);
  const note = !span ? "Käyrät erkanevat siitä ottelusta, jota skenaario ensimmäisenä muuttaa."
    : solid ? `Ennen ${pts[span.a].date} käyrät kulkevat yhdessä: ne ottelut malli arpoo tavalliseen tapaan. Kultainen alue (${pts[span.a].date}–${pts[span.b].date}) on lukitsemasi jakso, ja sen jälkeen syntynyt ero säilyy loppukauden.`
    : `Käyrät kulkevat yhdessä ${pts[span.a].date} asti. Jokainen ● on lukittu ottelu, muut ottelut malli arpoo tavalliseen tapaan.`;
  return (
    <figure className="sc-chart">
      <figcaption>{team}: odotettu pistekertymä</figcaption>
      <Legend />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${team} odotetut pisteet kauden lopussa: nyt ${f1(last.now)}, skenaariossa ${f1(last.scenario)}`}>
        {ticks.map((v) => (<g key={v}><line className="gridl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text className="axis" x={L - 6} y={y(v) + 3} textAnchor="end">{Math.round(v)}</text></g>))}
        {months.map(({ i, m }) => <text key={i} className="axis" x={x(i)} y={H - 10} textAnchor="middle">{Number(m)}/{pts[i].iso!.slice(2, 4)}</text>)}
        {solid && span && (<g>
          <rect className="sc-band" x={x(span.a) - step / 2} y={T} width={(span.b - span.a + 1) * step} height={H - T - B} rx={3} />
          <text className="sc-band-t" x={x(span.a) - step / 2 + 4} y={T + 11}>lukittu</text>
        </g>)}
        {/* Nykyennuste skenaarion päälle: kun käyrät kulkevat yhdessä, katkoviiva näkyy kullan päällä. */}
        <path d={line("scenario")} className="sc-scn" fill="none" />
        <path d={line("now")} className="sc-now" fill="none" />
        {pts.map((p, i) => p.locked && <circle key={i} className="sc-lock" cx={x(i)} cy={y(p.scenario)} r={4} />)}
        <text className="sc-val" x={W - R + 6} y={y(last.scenario) + 4 - labelGap}>{f1(last.scenario)} skenaario</text>
        <text className="sc-val dim" x={W - R + 6} y={y(last.now) + 4 + labelGap}>{f1(last.now)} nyt</text>
        {/* Hover: koko sarakkeen levyinen osuma-alue, vihje title-elementissä. */}
        {pts.map((p, i) => (
          <rect key={`h${i}`} className="sc-hit" x={x(i) - (W - L - R) / Math.max(1, pts.length - 1) / 2} y={T} width={(W - L - R) / Math.max(1, pts.length - 1)} height={H - T - B}>
            <title>{`${p.date}${p.opponent ? ` vs ${p.opponent}` : ""}${p.locked ? " (lukittu)" : ""}\nnyt ${f1(p.now)} p · skenaario ${f1(p.scenario)} p`}</title>
          </rect>
        ))}
      </svg>
      <p className="sc-explain">{note}</p>
      <p className="sc-note">Odotetut pisteet ottelu kerrallaan, 10 000 simuloitua kautta.</p>
    </figure>
  );
}

function DistChart({ d, team }: { d: { now: number[]; scenario: number[] }; team: string }) {
  const n = d.now.length, top = Math.max(...d.now, ...d.scenario, 0.05);
  const cw = (W - L - 12) / n, bw = (cw - 6) / 2;
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const peak = d.scenario.indexOf(Math.max(...d.scenario));
  return (
    <figure className="sc-chart">
      <figcaption>{team}: todennäköisyys päätyä kullekin sijalle</figcaption>
      <Legend />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${team} sijajakauma: todennäköisin sija skenaariossa ${peak + 1}.`}>
        {[0, top / 2, top].map((v) => (<g key={v}><line className="gridl" x1={L} x2={W - 12} y1={y(v)} y2={y(v)} /><text className="axis" x={L - 6} y={y(v) + 3} textAnchor="end">{pc(v)} %</text></g>))}
        {/* Vyöhykerajat: suoraan puolivälieriin 1–6, säälipudotus 7–10, putoaminen 15–17. */}
        {[6, 10, 14].map((k) => <line key={k} className="sc-zone" x1={L + k * cw} x2={L + k * cw} y1={T} y2={H - B} />)}
        {d.now.map((v, i) => {
          const s = d.scenario[i], x0 = L + i * cw + 2;
          return (
            <g key={i}>
              <rect className="sc-bar-now" x={x0} y={y(v)} width={bw} height={Math.max(0, H - B - y(v))} rx={2} />
              <rect className="sc-bar-scn" x={x0 + bw + 2} y={y(s)} width={bw} height={Math.max(0, H - B - y(s))} rx={2} />
              <text className="axis" x={x0 + bw + 1} y={H - 10} textAnchor="middle">{i + 1}</text>
              <rect className="sc-hit" x={L + i * cw} y={T} width={cw} height={H - T - B}><title>{`${i + 1}. sija\nnyt ${pc(v)} % · skenaario ${pc(s)} %`}</title></rect>
            </g>
          );
        })}
        <text className="sc-val" x={L + peak * cw + cw / 2} y={y(d.scenario[peak]) - 6} textAnchor="middle">{pc(d.scenario[peak])} %</text>
      </svg>
      <p className="sc-note">Sijat 1–6 suoraan puolivälieriin, 7–10 säälipudotuksiin, 15–17 putoamisuhka.</p>
    </figure>
  );
}

function GamesChart({ games }: { games: LockedGame[] }) {
  return (
    <figure className="sc-chart">
      <figcaption>Lukitut ottelut: kuinka todennäköisenä malli pitää kutakin tulosta</figcaption>
      <ul className="sc-games">
        {games.slice(0, 12).map((g, i) => (
          <li key={i}>
            <span className="sc-g">{g.date} {g.game}: <b>{g.result}</b></span>
            <span className="sc-pbar" role="img" aria-label={`${pc(g.p_model)} %`}><i style={{ width: `${Math.max(2, 100 * g.p_model)}%` }} /></span>
            <span className="sc-p">{pc(g.p_model)}&nbsp;%</span>
          </li>
        ))}
      </ul>
      {games.length > 12 && <p className="sc-note">+{games.length - 12} muuta ottelua</p>}
      {/* Yhteistodennäköisyys on yhteenvetorivillä kuvaajan alla; ei toisteta. */}
    </figure>
  );
}

export default function ScenarioChart({ pick, charts, locked, plausibility }: {
  pick: ChartPick; charts: Charts | null | undefined; locked: LockedGame[]; plausibility: number | null;
}) {
  const focus = charts?.focus ?? [];
  const want = pick?.team && focus.includes(pick.team) ? pick.team : focus[0];
  const [team, setTeam] = useState<string | undefined>(undefined);
  const t = team && focus.includes(team) ? team : want;
  if (!pick) return null;
  if (pick.type === "ottelut") return locked.length ? <GamesChart games={locked} /> : null;
  if (!charts || !t) return null;
  return (
    <div className="sc-wrap">
      {focus.length > 1 && (
        <div className="sc-teams" role="tablist" aria-label="Joukkue">
          {focus.map((f) => <button key={f} type="button" role="tab" aria-selected={f === t} className={f === t ? "on" : ""} onClick={() => setTeam(f)}>{f}</button>)}
        </div>
      )}
      {pick.type === "pisteet" && charts.points[t] ? <PointsChart pts={charts.points[t]} team={t} />
        : charts.dist[t] ? <DistChart d={charts.dist[t]} team={t} /> : null}
    </div>
  );
}
