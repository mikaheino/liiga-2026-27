// Yläpalkki: brändi (= etusivulle), osiot ja ennusteen aikaleima.
import Link from "next/link";

export function stamp(iso: string) {
  const f = new Intl.DateTimeFormat("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}. klo ${p.hour}.${p.minute}`;
}

export const SECTIONS = [
  ["/sarjataulukko", "Sarjataulukko"], ["/voittaja", "Voittaja"], ["/ottelut", "Ottelut"],
  ["/liike", "Liike"], ["/linkedin", "LinkedIn"], ["/mouho", "Mouho 2026"],
] as const;

export default function Top({ updatedAt, active }: { updatedAt?: string; active: string }) {
  return (
    <header className="top">
      <Link href="/" className="brand" aria-label="Etusivu">
        <span className="mark" aria-hidden>◆</span>
        <div>
          <div className="brand-name">Liiga Ennuste</div>
          <div className="brand-sub">Runkosarja 2026–27</div>
        </div>
      </Link>
      <nav className="topnav">
        {SECTIONS.map(([href, label]) => <Link key={href} href={href} className={active === href ? "on" : ""}>{label}</Link>)}
      </nav>
      <div className="fresh"><span className="dot" />{updatedAt ? stamp(updatedAt) : "–"}</div>
    </header>
  );
}
