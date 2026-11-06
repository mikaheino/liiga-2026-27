"use client";
// Kauden tilanne isona: kuinka paljon Liigaa on jäljellä. Käyttäjän toive 16.10.:
// yläpalkin etenemispalkki "voisi olla isompi". Luku lasketaan alas kuin
// ottelukello, ja "nyt"-merkki on kiekko joka liukuu paikalleen (NHL 95 -vivahde).
//
// Näkymätön kelain (6.11.2026): palkki itse on liukusäädin. Veto tai napautus
// pelatulla osalla kelaa alla olevan heatmapin siihen tilannekuvaan, jonka
// ottelumäärä on lähinnä (components/TimeTravel.tsx); luku ja kiekko seuraavat.
// Uutta ohjainta ei näy -- vain kursori, ja menneisyydessä pieni päivämäärä ja
// "nyt", joka palaa. Nuolinäppäimet askeltavat tilannekuvia, End/Escape palaa.
import { useRef, useState } from "react";
import { CountUp } from "@/components/Motion";
import { useTime } from "@/components/TimeTravel";

const dm = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`;

export default function Season({ played, total, nextDate, nextGames, compact = false }: {
  played: number; total: number; nextDate: string | null; nextGames: number; compact?: boolean;
}) {
  const { snaps, at, setAt, enabled } = useTime();
  const [touched, setTouched] = useState(false);          // kelauksen jälkeen ei uutta laskuanimaatiota
  const bar = useRef<HTMLDivElement>(null);
  const snap = at == null ? null : snaps[at];
  const shown = snap ? snap.played : played;
  const left = total - shown;
  const pct = total ? (100 * shown) / total : 0;
  const nowPct = total ? (100 * played) / total : 0;
  const rounds = Array.from({ length: 32 }, (_, i) => i);   // 32 x 17 ottelua = 544
  const done = Math.floor((shown / total) * rounds.length);
  const day = nextDate
    ? new Intl.DateTimeFormat("fi-FI", { weekday: "long", day: "numeric", month: "numeric", timeZone: "Europe/Helsinki" }).format(new Date(`${nextDate}T12:00:00Z`))
    : null;

  // Kohta palkilla -> lähin tilannekuva (saman ottelumäärän päivistä uusin);
  // pelattujen otteluiden kohdalla tai sen yli = nyt.
  function pick(clientX: number) {
    const r = bar.current?.getBoundingClientRect();
    if (!r || !snaps.length) return;
    const games = ((clientX - r.left) / r.width) * total;
    if (games >= played - 1) { setAt(null); return; }
    let best = 0;
    snaps.forEach((s, i) => {
      const d = Math.abs(s.played - games), b = Math.abs(snaps[best].played - games);
      if (d < b || (d === b && s.date > snaps[best].date)) best = i;
    });
    setAt(best); setTouched(true);
  }
  function key(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") setAt(at == null ? snaps.length - 1 : Math.max(0, at - 1));
    else if (e.key === "ArrowRight") setAt(at == null || at >= snaps.length - 1 ? null : at + 1);
    else if (e.key === "End" || e.key === "Escape") setAt(null);
    else if (e.key === "Home") setAt(0);
    else return;
    e.preventDefault(); setTouched(true);
  }
  const drag = enabled ? {
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pick(e.clientX); },
    onPointerMove: (e: React.PointerEvent) => { if (e.buttons) pick(e.clientX); },
    onKeyDown: key, tabIndex: 0, role: "slider" as const, "aria-label": "Kelaa kautta taaksepäin",
    "aria-valuemin": 0, "aria-valuemax": played, "aria-valuenow": shown,
    "aria-valuetext": snap ? `Tilanne ${dm(snap.date)}, ${snap.played} ottelua pelattu` : "Nyt",
  } : { "aria-hidden": true };

  return (
    <section className={`season-hero ${compact ? "mini" : ""} ${snap ? "past" : ""}`} aria-label="Kauden tilanne">
      <div className="sh-main">
        <div className="eyebrow">Runkosarja 2026–27</div>
        <div className="sh-big">
          <span className="sh-num">{touched ? left : <CountUp from={total} to={left} />}</span>
          <span className="sh-unit">ottelua<br />jäljellä</span>
        </div>
        <div className="sh-sub">
          {shown} / {total} pelattu · {snap
            ? <>tilanne {dm(snap.date)} <button type="button" className="sh-back" onClick={() => setAt(null)}>▶ nyt</button></>
            : `${(100 - pct).toFixed(0)} % kaudesta edessä`}
        </div>
      </div>
      <div className={`sh-track ${enabled ? "scrub" : ""}`} {...drag}>
        <div className="sh-bar" ref={bar}>
          {snap && <i className="sh-ghost" style={{ width: `${nowPct.toFixed(1)}%` }} />}
          <i style={{ width: `${pct.toFixed(1)}%` }} />
          <span className="sh-now" style={{ left: `${pct.toFixed(1)}%` }}><b className="puck" /></span>
        </div>
        <div className="sh-ticks">{rounds.map((i) => <span key={i} className={i < done ? "on" : ""} />)}</div>
        <div className="sh-scale"><span>Syyskuu</span><span>Joulukuu</span><span>Maaliskuu</span></div>
      </div>
      {day && !compact && (
        <div className="sh-next">
          <div className="sh-next-k"><span className="blink">▶</span> Seuraava pelipäivä</div>
          <div className="sh-next-d">{day}</div>
          <div className="sh-next-s">{nextGames} {nextGames === 1 ? "ottelu" : "ottelua"}</div>
        </div>
      )}
    </section>
  );
}
