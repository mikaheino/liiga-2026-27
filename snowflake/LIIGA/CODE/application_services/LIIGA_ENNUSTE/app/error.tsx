"use client";
// Sivun lataus epäonnistui (13.11.2026): ennen kehyksen oletusvirhe. Tavallisin syy on
// hetkellinen datakatko, joten uusi yritys on ensimmäinen vaihtoehto.
import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="oops">
      <div className="oops-code">!</div>
      <h1>Sivun lataus ei onnistunut</h1>
      <p>Data ei juuri nyt vastannut. Yritä hetken päästä uudelleen.</p>
      <div className="oops-links"><button type="button" className="btn" onClick={reset}>Yritä uudelleen</button><Link href="/">Etusivulle</Link></div>
    </main>
  );
}
