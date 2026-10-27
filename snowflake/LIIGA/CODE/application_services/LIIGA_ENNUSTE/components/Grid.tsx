// Yhteinen taulukkopohja kaikille osioille: sama muotokieli kuin
// sarjataulukossa, ja korostus haalentaa muut rivit (Streamlitin dim_class).
import Link from "next/link";
import { PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT, logo } from "@/lib/table";

// sm = piilotetaan puhelimessa; wsm = leveys puhelimessa (oletus: kiinteät leveydet
// ~60 %:iin ja minmax-minimit nollaan, jotta joukkueen nimi mahtuu).
export type Col = { h: string; w: string; wsm?: string; num?: boolean; sm?: boolean };

const narrow = (w: string) =>
  w.replace(/minmax\(\d+px,/g, "minmax(0,").replace(/^(\d+)px$/, (_, n) => `${Math.max(28, Math.round(Number(n) * 0.62))}px`);

export const zoneOf = (rank: number) => (rank <= PLAYOFF_CUT ? "z-top" : rank <= QUALI_CUT ? "z-quali" : rank > RELEGATION_CUT ? "z-down" : "z-mid");

// Joukkueen nimi avaa joukkuekortin kaikissa taulukoissa (korttiteema 27.10.).
export function Team({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <Link href={`/joukkue/${encodeURIComponent(name)}`} className="team team-link">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo(name)} alt="" width={size} height={size} />
      <span className="name">{name}</span>
    </Link>
  );
}

export default function Grid({ cols, rows, label }: {
  cols: Col[]; label: string;
  rows: { key: string; cells: React.ReactNode[]; cls?: string; on?: boolean | null }[];
}) {
  // Sarakkeet CSS-muuttujina eikä suoraan tyylinä: suora tyyli ohitti puhelimen
  // säännöt, ja kapealla näytöllä nimi puristui pois (27.10.).
  const vars = {
    "--cols": cols.map((c) => c.w).join(" "),
    "--cols-sm": cols.filter((c) => !c.sm).map((c) => c.wsm ?? narrow(c.w)).join(" "),
  } as React.CSSProperties;
  const anyOn = rows.some((r) => r.on);
  const cls = (c: Col) => `${c.num ? "num" : ""} ${c.sm ? "hide-sm" : ""}`;
  return (
    <div className={`tbl g ${anyOn ? "has-hl" : ""}`} role="table" aria-label={label}>
      <div className="tr th" role="row" style={vars}>
        {cols.map((c, k) => <div key={k} className={`${cls(c)} ${c.h === "#" ? "c" : ""}`}>{c.h}</div>)}
      </div>
      {rows.map((r, i) => (
        <div key={r.key} role="row" className={`tr ${r.cls ?? ""} ${r.on ? "hl" : ""}`}
          style={{ ...vars, animationDelay: `${i * 14}ms` }}>
          {r.cells.map((c, k) => <div key={k} className={cls(cols[k])}>{c}</div>)}
        </div>
      ))}
    </div>
  );
}
