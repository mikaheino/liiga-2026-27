"use client";
// Kauden kelaus (6.11.2026, käyttäjä: "pystyykö yllä olevaa 383 ottelua muuttamaan
// slideriksi joka muuttaa alla olevaa heatmapia menneisyyteen. slider pitäisi olla
// näkymätön"). Yhteinen tila etusivun yläpalkin (Season) ja heatmapin (HeatmapTime)
// välillä: `at` = valitun tilannekuvan indeksi, null = nyt. Ilman tarjoajaa (esim.
// /sijainti) konteksti on tyhjä ja komponentit näyttävät nykyhetken.
import { createContext, useContext, useEffect, useState } from "react";
import type { Snap } from "@/lib/data";

type Time = { snaps: Snap[]; at: number | null; setAt: (i: number | null) => void; enabled: boolean };
const Ctx = createContext<Time>({ snaps: [], at: null, setAt: () => {}, enabled: false });
export const useTime = () => useContext(Ctx);

export default function TimeTravel({ snaps, children }: { snaps: Snap[]; children: React.ReactNode }) {
  const [at, setAt] = useState<number | null>(null);
  // Uusi etusivu (6.11.2026): heatmap näkyy kaikilla leveyksillä, joten kelaus myös puhelimella.
  // Suora linkki hetkeen: #tilanne=2026-10-02 (demo, jakaminen) -- lähin tilannekuva siihen asti.
  useEffect(() => {
    const m = /^#tilanne=(\d{4}-\d{2}-\d{2})$/.exec(window.location.hash);
    if (!m) return;
    const i = snaps.map((s) => s.date <= m[1]).lastIndexOf(true);
    if (i >= 0) setAt(i);
  }, [snaps]);
  return <Ctx.Provider value={{ snaps, at, setAt, enabled: snaps.length > 0 }}>{children}</Ctx.Provider>;
}
