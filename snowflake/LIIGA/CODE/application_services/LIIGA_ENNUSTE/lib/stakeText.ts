// Panoksen esitys (6.11.2026). Luvut tulevat moottorista (lib/data.ts loadStakes);
// tämä vain muotoilee. Säilyminen näytetään putoamisena: lukija ajattelee riskiä.
import type { StakeRow } from "@/lib/data";
import { fi } from "@/lib/table";

const PHRASE: Record<StakeRow["goal"], string> = {
  avoid_relegation: "putoaa", top10: "pudotuspeleihin", top6: "kuuden joukkoon", win: "voittaa runkosarjan",
};

/** Näytettävä luku: putoaminen = 1 - säilyminen. */
export const shown = (r: StakeRow, p: number) => (r.goal === "avoid_relegation" ? 1 - p : p);
export const stakePct = (p: number) => (p > 0 && p < 0.005 ? "<1 %" : `${fi(100 * p, 0)} %`);
export const stakeLabel = (r: StakeRow) => `${r.team} ${PHRASE[r.goal]}`;
/** Näytetäänkö rivi: tulos liikuttaa lukua vähintään 2 %-yks. */
export const worthShowing = (r: StakeRow | undefined) => !!r && Math.abs(r.delta) >= 0.02;
