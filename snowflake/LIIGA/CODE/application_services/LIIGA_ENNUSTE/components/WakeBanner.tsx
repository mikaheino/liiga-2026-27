"use client";
// Mobiilisovellus vähin krediitein (21.11.2026): rekisteröi service workerin (public/sw.js)
// ja näyttää ilmoituksen, kun sovellus näyttää välimuistin version palvelun herätessä.
// Kun palvelu vastaa taas, sivu päivittyy. Vain App Runtimessa (Pagesilla oma välimuistinsa).
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { STATIC } from "@/lib/target";
import { setWaking, useWaking } from "@/lib/waking";

const POLL_MS = 15_000;

export default function WakeBanner() {
  const router = useRouter();
  const waking = useWaking();

  useEffect(() => {
    if (STATIC || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "liiga-waking") setWaking(true); };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!waking) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/manifest.webmanifest", { cache: "no-store" });
        if (r.ok) { setWaking(false); router.refresh(); }
      } catch { /* yhä hereillä olematta */ }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [waking, router]);

  if (!waking) return null;
  return (
    <div role="status" style={{
      position: "fixed", left: 12, right: 12, top: "calc(env(safe-area-inset-top) + 10px)", zIndex: 60,
      background: "var(--surface-2)", border: "1px solid var(--gold-dim)", borderRadius: "var(--r)",
      color: "var(--body)", padding: "10px 14px", fontSize: 14, boxShadow: "0 6px 24px rgba(0,0,0,.5)",
    }}>
      <b style={{ color: "var(--gold-hi)" }}>Palvelu herää säästötilasta.</b> Näytetään viimeksi haetut tiedot, sivu päivittyy itsestään.
    </div>
  );
}
