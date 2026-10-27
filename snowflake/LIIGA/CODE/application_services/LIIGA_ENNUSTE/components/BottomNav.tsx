"use client";
// Puhelimen alavalikko (27.10., käyttäjä: "hyvä mobiilikäyttöliittymä"). Yläpalkin
// osiot piiloutuvat kapealla näytöllä, ja ilman tätä osioihin pääsi vain etusivun
// ovista. Peukalon ulottuvilla, näkyy vain alle 860 px:n leveydellä (globals.css).
import Link from "next/link";
import { usePathname } from "next/navigation";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ITEMS: [string, string, React.ReactNode][] = [
  ["/", "Koti", <path key="i" {...P} d="M12 3 21 12 12 21 3 12Z" />],
  ["/sarjataulukko", "Taulukko", <path key="i" {...P} d="M4 6h16M4 12h16M4 18h16M8 4v16" />],
  ["/voittaja", "Voittaja", <path key="i" {...P} d="M8 4h8v5a4 4 0 0 1-8 0ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />],
  ["/ottelut", "Ottelut", <path key="i" {...P} d="M4 6h16v14H4ZM4 10h16M9 3v5M15 3v5" />],
  ["/liike", "Liike", <path key="i" {...P} d="M3 17 9 11l4 4 8-8M15 7h6v6" />],
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bnav" aria-label="Osiot">
      {ITEMS.map(([href, label, icon]) => {
        const on = href === "/" ? path === "/" || path.startsWith("/joukkue") : path.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden>{icon}</svg>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
