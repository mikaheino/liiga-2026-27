// Yhteinen taulukkopohja kaikille osioille: sama muotokieli kuin
// sarjataulukossa, ja korostus haalentaa muut rivit (Streamlitin dim_class).
import { PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT, logo } from "@/lib/table";

export type Col = { h: string; w: string; num?: boolean; sm?: boolean };

export const zoneOf = (rank: number) => (rank <= PLAYOFF_CUT ? "z-top" : rank <= QUALI_CUT ? "z-quali" : rank > RELEGATION_CUT ? "z-down" : "z-mid");

export function Team({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span className="team">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo(name)} alt="" width={size} height={size} />
      <span className="name">{name}</span>
    </span>
  );
}

export default function Grid({ cols, rows, label }: {
  cols: Col[]; label: string;
  rows: { key: string; cells: React.ReactNode[]; cls?: string; on?: boolean | null }[];
}) {
  const template = cols.map((c) => c.w).join(" ");
  const anyOn = rows.some((r) => r.on);
  const cls = (c: Col) => `${c.num ? "num" : ""} ${c.sm ? "hide-sm" : ""}`;
  return (
    <div className={`tbl g ${anyOn ? "has-hl" : ""}`} role="table" aria-label={label}>
      <div className="tr th" role="row" style={{ gridTemplateColumns: template }}>
        {cols.map((c, k) => <div key={k} className={`${cls(c)} ${c.h === "#" ? "c" : ""}`}>{c.h}</div>)}
      </div>
      {rows.map((r, i) => (
        <div key={r.key} role="row" className={`tr ${r.cls ?? ""} ${r.on ? "hl" : ""}`}
          style={{ gridTemplateColumns: template, animationDelay: `${i * 14}ms` }}>
          {r.cells.map((c, k) => <div key={k} className={cls(cols[k])}>{c}</div>)}
        </div>
      ))}
    </div>
  );
}
