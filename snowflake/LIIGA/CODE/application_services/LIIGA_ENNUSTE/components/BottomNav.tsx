"use client";
// Puhelimen alavalikko (27.10., käyttäjä: "hyvä mobiilikäyttöliittymä"). Yläpalkin
// osiot piiloutuvat kapealla näytöllä. Peukalon ulottuvilla, näkyy vain alle 860 px:n
// leveydellä (globals.css).
// 13.11.2026: viisi kohtaa. Seitsemän kohtaa vaati 8 px:n tekstin, ja Sijainnit puuttui
// kokonaan. Ennusteen kolme näkymää ja loput osiot avautuvat kohdan päältä listana.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { STATIC } from "@/lib/target";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
type Sub = [href: string, label: string, hint: string];
type Item = { key: string; label: string; icon: string; href?: string; sub?: Sub[] };

const ITEMS: Item[] = [
  { key: "koti", label: "Koti", href: "/", icon: "M12 3 21 12 12 21 3 12Z" },
  { key: "ottelut", label: "Ottelut", href: "/ottelut", icon: "M4 6h16v14H4ZM4 10h16M9 3v5M15 3v5" },
  { key: "taulukko", label: "Taulukko", href: "/sarjataulukko", icon: "M4 6h16M4 12h16M4 18h16M8 4v16" },
  { key: "ennuste", label: "Ennuste", icon: "M3 17 9 11l4 4 8-8M15 7h6v6", sub: [
    ["/sijainti", "Sijainnit", "Mihin sijaan kukin joukkue päätyy"],
    ["/voittaja", "Voittaja", "Runkosarjan voiton todennäköisyys"],
    ["/liike", "Liike", "Miten ennuste on muuttunut"],
  ] },
  { key: "lisaa", label: "Lisää", icon: "M5 12h.01M12 12h.01M19 12h.01", sub: [
    ["/pelaajat", "Pelaajat", "Pisteet, maalivahdit ja pelaajakortit"],
    // Uutiset ja haastaja vain Pagesissa (data news-data-haarasta); LinkedIn ja peli vain sovelluksessa.
    ...(STATIC ? [["/uutiset", "Uutiset", "Uutiset, poissaolot ja haastajamalli"] as Sub]
      : [["/linkedin", "LinkedIn", "Postausluonnokset"] as Sub, ["/mouho", "Mouho 2026", "Peli"] as Sub]),
    ["/tietoa", "Tietoa", "Miten ennuste lasketaan ja miten se on osunut"],
  ] },
];

export default function BottomNav() {
  const path = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setOpen(null), [path]);                    // lista kiinni, kun sivu vaihtuu
  const at = (href: string) => (href === "/" ? path === "/" || path.startsWith("/joukkue") : path.startsWith(href));
  const sheet = ITEMS.find((i) => i.key === open);
  return (
    <>
      {sheet?.sub && (
        <>
          <button className="bnav-shade" aria-label="Sulje valikko" onClick={() => setOpen(null)} />
          <div className="bnav-sheet" role="menu" aria-label={sheet.label}>
            {sheet.sub.map(([href, label, hint]) => (
              <Link key={href} href={href} role="menuitem" className={at(href) ? "on" : ""} onClick={() => setOpen(null)}>
                <b>{label}</b><span>{hint}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      <nav className="bnav" aria-label="Osiot">
        {ITEMS.map((i) => {
          const on = open ? open === i.key : i.href ? at(i.href) : i.sub!.some(([h]) => at(h));
          const inner = <><svg viewBox="0 0 24 24" aria-hidden><path {...P} d={i.icon} /></svg><span>{i.label}</span></>;
          return i.href
            ? <Link key={i.key} href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined} onClick={() => setOpen(null)}>{inner}</Link>
            : <button key={i.key} type="button" className={on ? "on" : ""} aria-haspopup="menu" aria-expanded={open === i.key}
                onClick={() => setOpen(open === i.key ? null : i.key)}>{inner}</button>;
        })}
      </nav>
    </>
  );
}
