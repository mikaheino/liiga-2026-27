// Ottelut ja mallin toteuma. Tämä ja sijaintijakauma ovat ainoat paikat joissa
// mallin osuvuus näkyy (CLAUDE.md) -- ne eivät väisty designin tieltä.
// ✓/✗ kantaa osuman itse; väri yksin pettäisi sen, joka ei erota kultaa punaisesta.
import Link from "next/link";
import Grid, { Team } from "@/components/Grid";
import { CountUp } from "@/components/Motion";
import { type Fixture, MONTHS_FI, misses, modelSaid, resultText, scoreboard } from "@/lib/fixtures";
import { fi } from "@/lib/table";

const day = (ts: string) => `${Number(ts.slice(8, 10))}.${Number(ts.slice(5, 7))}.`;
const on = (f: Fixture, hl: Set<string>) => (hl.size ? hl.has(f.home) || hl.has(f.away) : null);

function Prob({ p }: { p: number | null }) {
  if (p == null) return <span className="dim">–</span>;
  return <div className="pbar"><i style={{ width: `${p.toFixed(1)}%` }} /><span>{Math.round(p)} %</span></div>;
}

function Verdict({ f }: { f: Fixture }) {
  const s = modelSaid(f);
  if (s == null) return null;
  return <span className={`verdict ${s >= 50 ? "hit" : "miss"}`}>{s >= 50 ? "✓" : "✗"} {Math.round(s)} %</span>;
}

export function Score({ fixtures }: { fixtures: Fixture[] }) {
  const s = scoreboard(fixtures);
  if (!s.n) return null;
  const rate = (100 * s.hits) / s.n, base = (100 * s.home) / s.n, gap = s.hits - s.home;
  return (
    <div className="score">
      <div className="score-main">
        <span className={`score-n ${gap > 0 ? "up" : gap < 0 ? "down" : ""}`}><CountUp from={0} to={Math.round(rate)} ms={1100} /><small>%</small></span>
        <span className="score-k">voittajista oikein<br /><b>{s.hits}/{s.n}</b></span>
      </div>
      <div className="score-vs">
        <span className="score-k">aina kotijoukkue</span>
        <span className="score-b">{Math.round(base)} %</span>
        <span className="score-k">{gap === 0 ? "tasoissa" : `${gap > 0 ? "+" : "−"}${Math.abs(gap)} osumaa`}</span>
      </div>
    </div>
  );
}

export function Months({ months, chosen, href }: { months: string[]; chosen: string; href: (m: string) => string }) {
  return (
    <nav className="months" aria-label="Kuukausi">
      {months.map((m) => (
        <Link key={m} href={href(m)} scroll={false} className={m === chosen ? "on" : ""}>{MONTHS_FI[Number(m.slice(5, 7)) - 1].replace(/kuu$/, "")}</Link>
      ))}
    </nav>
  );
}

export function FixtureList({ fixtures, highlight }: { fixtures: Fixture[]; highlight: Set<string> }) {
  return (
    <Grid label="Ottelut" cols={[{ h: "Pvm", w: "56px", num: true }, { h: "Ottelu", w: "minmax(200px, 1.6fr)" },
      { h: "Koti", w: "minmax(90px, 1fr)" }, { h: "Vieras", w: "minmax(90px, 1fr)" }, { h: "JA", w: "52px", num: true, sm: true },
      { h: "Tulos", w: "70px", num: true }, { h: "Voittajalle", w: "100px", num: true }]}
      rows={fixtures.map((f) => {
        const p = f.pHome == null ? null : f.pHome * 100;
        return {
          key: `${f.start_ts}${f.home}`, on: on(f, highlight), cls: f.ended ? "played" : "",
          cells: [<span key="d" className="dim">{day(f.start_ts)}</span>,
            <span key="m" className="match"><Team name={f.home} size={18} /><span className="dash">–</span><Team name={f.away} size={18} /></span>,
            <Prob key="h" p={p} />, <Prob key="a" p={p == null ? null : 100 - p} />,
            <span key="o" className="dim">{f.pOt == null ? "–" : `${Math.round(f.pOt * 100)} %`}</span>,
            <b key="r">{resultText(f)}</b>, <Verdict key="v" f={f} />],
        };
      })} />
  );
}

export function Misses({ fixtures, highlight }: { fixtures: Fixture[]; highlight: Set<string> }) {
  const m = misses(fixtures);
  if (!m.n) return null;
  return (
    <div className="misses">
      <Grid label="Joukkueittain" cols={[{ h: "Joukkue", w: "minmax(130px, 1fr)" }, { h: "Odotti", w: "64px", num: true },
        { h: "Voitti", w: "56px", num: true }, { h: "Ero", w: "92px", num: true }]}
        rows={m.byTeam.map((r) => {
          const sure = Math.abs(r.z) >= 2;
          return {
            key: r.team, on: highlight.size ? highlight.has(r.team) : null,
            cells: [<Team key="t" name={r.team} size={18} />, <span key="e" className="dim">{fi(r.exp)}</span>, r.won,
              <span key="d" className={sure ? (r.diff > 0 ? "up strong" : "down strong") : "dim"}
                title={sure ? "Ero on yli kaksi hajontaa: tuskin pelkkää sattumaa" : undefined}>
                {r.diff > 0 ? "+" : ""}{fi(r.diff)}{sure ? (r.diff > 0 ? " ▲" : " ▼") : ""}</span>],
          };
        })} />
      <div className="misses-side">
        <Grid label="Varmuus" cols={[{ h: "Suosikki", w: "minmax(90px, 1fr)" }, { h: "O", w: "44px", num: true },
          { h: "Lupasi", w: "64px", num: true }, { h: "Osui", w: "56px", num: true }]}
          rows={m.buckets.map((b) => ({ key: b.name, cells: [b.name, <span key="n" className="dim">{b.n}</span>, `${Math.round(b.promised)} %`, <b key="h">{Math.round(b.hit)} %</b>] }))} />
        <Grid label="Suurimmat hutit" cols={[{ h: "Pvm", w: "50px", num: true }, { h: "Suurimmat hutit", w: "minmax(150px, 1fr)" },
          { h: "Tulos", w: "64px", num: true }, { h: "", w: "56px", num: true }]}
          rows={m.worst.map((f) => ({
            key: `${f.start_ts}${f.home}`, on: on(f, highlight),
            cells: [<span key="d" className="dim">{day(f.start_ts)}</span>, <span key="m" className="pair">{f.home} – {f.away}</span>,
              resultText(f), <span key="v" className="down strong">{Math.round(modelSaid(f)!)} %</span>],
          }))} />
      </div>
    </div>
  );
}
