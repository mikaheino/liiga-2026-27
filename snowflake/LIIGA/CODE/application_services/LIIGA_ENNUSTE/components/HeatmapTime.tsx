"use client";
// Heatmap, joka seuraa kauden kelausta (components/TimeTravel.tsx, 6.11.2026).
// Joukkueet asettuvat valitun hetken järjestykseen ja LIUKUVAT uusille paikoilleen
// (FLIP: vanha paikka mitataan, rivi siirretään sinne transformilla ja päästetään
// liukumaan). Käyttäjä: paikallaan pysyvät rivit -- "Lukko pysyy paikallaan
// kokoajan, tosin heatmap arvo liikkuu. Lukija ei osaa tulkita tätä."
// Sija = sen päivän PREDICTION_HISTORY.proj_rank; pisterajasarakkeissa viiva,
// koska rajaa ei ole tallennettu historiaan.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Heatmap, { type Line, type Need, type PositionRow } from "@/components/Heatmap";
import { useTime } from "@/components/TimeTravel";
import type { Snap } from "@/lib/data";

const expected = (p: number[]) => p.reduce((s, x, i) => s + x * (i + 1), 0);
// Palvelinkomponentti (PositionBoard) ei voi antaa funktiota selaimelle, joten
// linkki on totuusarvo ja osoite muodostetaan täällä (sama kuin lib/data teamHref).
const teamLink = (team: string) => `/joukkue/${encodeURIComponent(team)}`;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function HeatmapTime({ link, rows: nowRows, perTeam = 0, ...rest }: {
  rows: PositionRow[]; highlight: Set<string>; link?: boolean; need?: Map<string, Need>; line?: Line | null; perTeam?: number;
}) {
  const { snaps, at } = useTime();
  const snap = at == null ? null : snaps[at];
  // Kun kerran on kelattu, solujen sisääntuloanimaatio ei saa soida uudelleen:
  // todennäköisimmän sijan (.peak) siirtyminen vaihtaisi solun animaatiolistan ja
  // käynnistäisi sen viiveineen alusta -- solut välkkyisivät tyhjinä.
  const [settled, setSettled] = useState(false);
  useEffect(() => { if (at != null) setSettled(true); }, [at]);

  let rows = nowRows;
  if (snap) {
    // Sen hetken sija; jos puuttuu, odotettu sija jakaumasta.
    const fallback = new Map(nowRows.map((r) => [r.team, expected(snap.p[r.team] ?? r.p)]));
    rows = nowRows.map((r) => ({ ...r, p: snap.p[r.team] ?? r.p.map(() => 0), projRank: snap.rank[r.team] ?? 0 }))
      .sort((a, b) => (a.projRank || 99) - (b.projRank || 99) || fallback.get(a.team)! - fallback.get(b.team)!)
      .map((r, i) => ({ ...r, projRank: r.projRank || i + 1 }));
  }

  // FLIP: rivien siirtymä järjestyksen vaihtuessa.
  const box = useRef<HTMLDivElement>(null);
  const tops = useRef(new Map<string, number>());
  const order = rows.map((r) => r.team).join(",");
  useLayoutEffect(() => {
    const els = [...(box.current?.querySelectorAll<HTMLElement>("[data-team]") ?? [])];
    const now = new Map(els.map((e) => [e.dataset.team!, e.getBoundingClientRect().top]));
    if (!reduced()) {
      for (const e of els) {
        const before = tops.current.get(e.dataset.team!), after = now.get(e.dataset.team!)!;
        if (before == null || Math.abs(before - after) < 1) continue;
        e.style.transition = "none";
        e.style.transform = `translateY(${before - after}px)`;
        requestAnimationFrame(() => {
          e.style.transition = "transform .45s cubic-bezier(.2,.8,.2,1)";
          e.style.transform = "";
        });
      }
    }
    tops.current = now;
  }, [order]);

  // Tarvittavat pisteet sen hetken rajasta ja joukkueiden silloisista pisteistä (6.11.).
  // Ilman tallennettua rajaa sarakkeissa viiva.
  const pastLine = snap?.line ? snapLine(snap) : null;
  const pastNeed = snap?.line && perTeam
    ? new Map(nowRows.map((r) => [r.team, { pts: snap.table[r.team]?.pts ?? 0, left: Math.max(perTeam - (snap.table[r.team]?.gp ?? 0), 0) }]))
    : undefined;
  const props = { ...rest, rows, link: link ? teamLink : undefined, settled: settled || at != null };
  return (
    <div ref={box}>
      {!snap ? <Heatmap {...props} />
        : pastLine ? <Heatmap {...props} need={pastNeed ?? props.need} line={pastLine} />
        : <Heatmap {...props} past />}
    </div>
  );
}

// Sen hetken raja: "nyt"-arvo = sijan `rank` pisteet silloisessa sarjataulukossa.
function snapLine(snap: Snap): Line {
  const l = snap.line!;
  const pts = Object.values(snap.table).map((t) => t.pts).sort((a, b) => b - a);
  return { rank: l.rank, likely: l.likely, safe: l.safe, now: pts[l.rank - 1] ?? null };
}

// Rajarivi heatmapin yläpuolella: nyt pisterajat, menneisyydessä tilannekuvan päivä.
export function LineNote({ lineRank, likely, safe, now, children }: {
  lineRank: number; likely: number; safe?: number; now?: number | null; children?: React.ReactNode;
}) {
  const { snaps, at } = useTime();
  const snap = at == null ? null : snaps[at];
  if (snap) {
    const l = snap.line ? snapLine(snap) : null;
    return (
      <div className="line-note past">
        Tilanne <b>{Number(snap.date.slice(8, 10))}.{Number(snap.date.slice(5, 7))}.</b>
        <span><b>{snap.played}</b> ottelua pelattu</span>
        {l && <>
          <span>{l.rank} parhaan raja: todennäköinen <b>{l.likely} p</b></span>
          <span>varma <b>{l.safe} p</b></span>
          {l.now != null && <span>{l.rank}. sijalla <b>{l.now} p</b></span>}
        </>}
      </div>
    );
  }
  return (
    <div className="line-note" title="Todennäköinen: riittää 14 parhaan joukkoon puolessa simulaatioista. Varma: 95 %:ssa. Nyt: 14. sijan pisteet sarjataulukossa.">
      {lineRank} parhaan raja:
      <span>todennäköinen <b>{likely} p</b></span>
      {safe != null && <span>varma <b>{safe} p</b></span>}
      {now != null && <span>nyt {lineRank}. sijalla <b>{now} p</b></span>}
      {children}
    </div>
  );
}
