// "Miten ennuste on liikkunut" -- streamlit_app.py:n render_history. Pieni
// paneeli per joukkue eikä 17 viivaa yhdessä: jokainen paneeli toistaa muiden
// viivat harmaana, joten joukkue luetaan kenttää eikä tyhjää vasten.
// Yhteinen y-asteikko, jotta paneelit ovat keskenään vertailukelpoisia.
import { logo } from "@/lib/table";
import { fi } from "@/lib/table";
import type { HistoryPoint } from "@/components/TitleRace";

export default function History({ history, order, highlight, preseason }: {
  history: HistoryPoint[]; order: string[]; highlight: Set<string>; preseason: Map<string, number>;
}) {
  const dates = [...new Set(history.map((h) => h.date))].sort();
  if (dates.length < 2) return null;
  const panels = highlight.size ? [...order.filter((t) => highlight.has(t)), ...order.filter((t) => !highlight.has(t))] : order;
  const W = 200, H = 70;
  const lo = Math.min(...history.map((h) => h.points)), hi = Math.max(...history.map((h) => h.points));
  const x = (d: string) => (dates.indexOf(d) / (dates.length - 1)) * W;
  const y = (v: number) => H - 4 - ((v - lo) / Math.max(hi - lo, 1)) * (H - 8);
  const series = new Map(order.map((t) => [t, history.filter((h) => h.team === t).sort((a, b) => a.date.localeCompare(b.date))]));
  const path = (pts: HistoryPoint[]) => pts.map((p, k) => `${k ? "L" : "M"}${x(p.date).toFixed(1)} ${y(p.points).toFixed(1)}`).join(" ");
  // Harmaa kenttä piirretään kerran ja käytetään jokaisessa paneelissa.
  const context = order.map((t) => path(series.get(t) ?? [])).join(" ");
  return (
    <div className={`multiples ${highlight.size ? "has-hl" : ""}`}>
      {panels.map((t, i) => {
        const pts = series.get(t) ?? [];
        if (!pts.length) return null;
        const last = pts[pts.length - 1];
        const base = preseason.get(t);
        const delta = base == null ? null : last.points - base;
        return (
          <figure key={t} className={`panel ${highlight.has(t) ? "hl" : ""}`}>
            <figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo(t)} alt="" width={16} height={16} />
              <span className="name">{t}</span>
              <b>{Math.round(last.points)}</b>
              {delta != null && <span className={`mv ${Math.abs(delta) < 0.5 ? "mv-0" : delta > 0 ? "mv-up" : "mv-dn"}`} title="Muutos esikauden julkaistusta ennusteesta">
                {Math.abs(delta) < 0.5 ? "=" : `${delta > 0 ? "+" : ""}${fi(delta)}`}</span>}
            </figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
              <path d={context} className="ctx" fill="none" />
              <path d={path(pts)} pathLength={1} className="draw focus" fill="none" style={{ animationDelay: `${i * 40}ms` }} />
              <circle cx={x(last.date)} cy={y(last.points)} r={2.6} className="pulse dotc" style={{ animationDelay: `${i * 260}ms` }} />
            </svg>
          </figure>
        );
      })}
    </div>
  );
}
