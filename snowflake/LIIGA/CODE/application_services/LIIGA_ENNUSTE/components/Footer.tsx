// Alatunniste joka sivulla (13.11.2026): mistä data tulee, milloin ennuste on laskettu,
// miten se tehdään ja että sivu ei ole Liigan oma. Puhelimessa sivupalkin lähdemaininta
// (Shell: rail-foot) ei näy, joten tämä oli siellä ainoa paikka kertoa ne.
import Link from "next/link";
import { stamp } from "@/components/Top";
import { loadMeta } from "@/lib/data";

export default async function Footer() {
  const meta = await loadMeta().then((m) => m.meta).catch(() => null);
  return (
    <footer className="foot">
      <div className="foot-in">
        <div>
          <b>Liiga Ennuste</b>
          <span>Runkosarjan 2026–27 ennuste. Tulokset: liiga.fi{meta?.UPDATED_AT ? ` · ennuste laskettu ${stamp(meta.UPDATED_AT)}` : ""}.</span>
        </div>
        <nav aria-label="Tietoa sivustosta">
          <Link href="/tietoa">Miten ennuste lasketaan</Link>
          <Link href="/ottelut">Mallin osuvuus</Link>
        </nav>
        <p>Epävirallinen harrastesivu. Ei Liigan eikä seurojen palvelu; joukkueiden nimet ja tunnukset kuuluvat omistajilleen.
          Todennäköisyydet ovat mallin arvioita, eivät vedonlyöntivihjeitä.</p>
      </div>
    </footer>
  );
}
