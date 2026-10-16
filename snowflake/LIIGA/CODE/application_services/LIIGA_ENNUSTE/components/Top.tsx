// Yläpalkki: brändi, kaksi näkymää ja ennusteen aikaleima.
import Link from "next/link";

export function stamp(iso: string) {
  const f = new Intl.DateTimeFormat("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}. klo ${p.hour}.${p.minute}`;
}

export default function Top({ updatedAt, active }: { updatedAt?: string; active: "ennuste" | "linkedin" }) {
  return (
    <header className="top">
      <div className="brand">
        <span className="mark" aria-hidden>◆</span>
        <div>
          <div className="brand-name">Liiga Ennuste</div>
          <div className="brand-sub">Runkosarja 2026–27</div>
        </div>
      </div>
      <nav className="topnav">
        <Link href="/" className={active === "ennuste" ? "on" : ""}>Ennuste</Link>
        <Link href="/linkedin" className={active === "linkedin" ? "on" : ""}>LinkedIn</Link>
      </nav>
      <div className="fresh"><span className="dot" />{updatedAt ? stamp(updatedAt) : "–"}</div>
    </header>
  );
}
