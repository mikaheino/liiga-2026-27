"use client";
// Poissaolokortti joukkuesivulla (6.11.2026, docs/claude/skenaario.md V6). Puuttuvat
// vakiot = pelanneet 7 joukkueen 10 edellisestä ottelusta mutta puuttuivat viimeisimmästä.
// Vaikutus joukkueen elävimpään tavoitteeseen on moottorin laskema (samat 10 000 kautta,
// mallin omat kaavat); kesto valitaan napeilla. Näkyy vain, kun puuttuvia on yli
// joukkueen tavallisen määrän ja vaikutus on vähintään 1 %-yks.
import { useState } from "react";
import type { TeamAbsence } from "@/lib/data";
import { fi } from "@/lib/table";

const LABEL = { week: "1 vko", month: "4 vko", season: "loppukausi" } as const;
const GOAL = { avoid_relegation: "Putoamisriski", top10: "Pudotuspeleihin", top6: "Kuuden joukkoon", win: "Runkosarjan voitto" } as const;

export default function AbsenceCard({ a }: { a: TeamAbsence }) {
  const [k, setK] = useState<keyof typeof LABEL>("month");
  const d = a.durations[k];
  const show = (p: number) => (a.goal === "avoid_relegation" ? 1 - p : p);
  const pct = (p: number) => `${fi(100 * show(p), 0)} %`;
  return (
    <div className="mc-box">
      <div className="label">Poissaolot</div>
      <p className="sc-line">
        Viime ottelusta puuttui {a.missing.length} vakiopelaajaa: <b>{a.missing.map((m) => m.name).join(", ")}</b>
        {" "}(tavallisesti puuttuu {fi(a.baseline, 1)} per ottelu). Puuttuminen voi olla myös lepuutus.
      </p>
      <div className="sc-streak">
        <span className="dim">Jos poissa</span>
        {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((x) => (
          <button key={x} type="button" className={`sc-chip ${k === x ? "on" : ""}`} aria-pressed={k === x} onClick={() => setK(x)}>{LABEL[x]}</button>
        ))}
      </div>
      {d && <p className="sc-line">{GOAL[a.goal]}: <b>{pct(d.p_now)}</b> → <b>{pct(d.p)}</b></p>}
      <p className="sc-basis dim">Mallin omat kaavat: pelaaja pois joukkueen vahvuudesta, tilalle seuraava.{a.forecastDate ? ` Ennuste ${Number(a.forecastDate.slice(8, 10))}.${Number(a.forecastDate.slice(5, 7))}.` : ""}</p>
    </div>
  );
}
