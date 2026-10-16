"use client";
// Liike joka tarvitsee selaimen: luvun laskenta ja osioiden esiin liukuminen.
// Vähennetyllä liikkeellä osiot näkyvät suoraan. Luku lasketaan silti: se ei
// liikuta mitään ruudulla, vain vaihtaa numeroa (sama perustelu kuin hehkulla).
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Pelikello: kokonaisluvut askel kerrallaan, hidastuen loppua kohti.
export function CountUp({ from, to, ms = 1400, suffix = "" }: { from: number; to: number; ms?: number; suffix?: string }) {
  const [v, setV] = useState(to);          // palvelin ja ensimmäinen piirto näyttävät oikean luvun
  useEffect(() => {
    if (from === to) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min((t - t0) / ms, 1);
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms]);
  return <>{v}{suffix}</>;
}

// Osio liukuu esiin kun se tulee näkyviin -- kerran, ei joka vierityksellä.
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <section ref={ref} className={`${className} reveal ${shown ? "in" : ""}`}>{children}</section>;
}
