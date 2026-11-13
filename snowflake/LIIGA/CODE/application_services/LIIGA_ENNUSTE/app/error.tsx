"use client";
// Sivun lataus epäonnistui (13.11.2026): ennen kehyksen oletusvirhe. Tavallisin syy on
// hetkellinen datakatko, joten uusi yritys on ensimmäinen vaihtoehto.
// Virhe kirjataan konsoliin (kehityspalvelin vie sen lokiin .next/dev/logs) ja näytetään
// kehitystilassa: ensimmäinen versio piilotti syyn, eikä kaatumista voinut jäljittää.
import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(`[virhesivu] ${error.name}: ${error.message}${error.digest ? ` (digest ${error.digest})` : ""}\n${error.stack ?? ""}`); }, [error]);
  return (
    <main className="oops">
      <div className="oops-code">!</div>
      <h1>Sivun lataus ei onnistunut</h1>
      <p>Jokin meni vikaan sivua näytettäessä. Yritä hetken päästä uudelleen.</p>
      {process.env.NODE_ENV !== "production" && <p className="oops-dev">{error.name}: {error.message}</p>}
      <div className="oops-links"><button type="button" className="btn" onClick={reset}>Yritä uudelleen</button><Link href="/">Etusivulle</Link></div>
    </main>
  );
}
