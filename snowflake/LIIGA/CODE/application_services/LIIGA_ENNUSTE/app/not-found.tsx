// Tuntematon osoite (13.11.2026): ennen kehyksen oletussivu ilman valikkoa.
import Link from "next/link";

export const metadata = { title: "Sivua ei löytynyt" };

export default function NotFound() {
  return (
    <main className="oops">
      <div className="oops-code">404</div>
      <h1>Kiekko meni yli laidan</h1>
      <p>Tätä sivua ei ole. Osoite on voinut muuttua tai joukkueen nimi on kirjoitettu eri tavalla.</p>
      <div className="oops-links"><Link href="/" className="btn">Etusivulle</Link><Link href="/ottelut">Ottelut</Link><Link href="/sarjataulukko">Sarjataulukko</Link></div>
    </main>
  );
}
